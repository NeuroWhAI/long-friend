import type { ChatModel } from '@/ai/chat-models';
import { type Kysely, sql } from 'kysely';
import type { Database, NodeEntity, NodeTable } from './types';

export class Network {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly chatModel: ChatModel,
  ) {}

  private nodes: Map<number, NetworkNode> = new Map();
  private activatedNodes: Map<number, NetworkNode> = new Map();

  async activateNode(memory: string): Promise<void> {
    const now = new Date();

    const embedding = await this.chatModel.embed(memory);
    const embeddingJson = JSON.stringify(embedding);

    const embeddingKey: keyof NodeTable = 'embedding';
    const similarNodes = await this.db
      .selectFrom('nodes')
      .select([
        'id',
        'memory',
        'createdAt',
        'lastActiveAt',
        sql<number>`${sql.ref(embeddingKey)} <=> ${embeddingJson}`.as('distance'),
      ])
      .orderBy(sql<number>`${sql.ref(embeddingKey)} <=> ${embeddingJson}`)
      .limit(4)
      .execute();

    // 거의 유사한 노드가 없는 경우 새 노드 생성.
    if (similarNodes.length === 0 || similarNodes[0].distance > 0.2) {
      const nodeEntity = await this.db
        .insertInto('nodes')
        .values({
          memory,
          embedding: embeddingJson,
          createdAt: now,
          lastActiveAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const node = new NetworkNode(nodeEntity, 1);
      this.nodes.set(nodeEntity.id, node);
      this.activatedNodes.set(nodeEntity.id, node);
    }

    if (similarNodes.length > 0) {
      await this.db
        .updateTable('nodes')
        .where(
          'id',
          'in',
          similarNodes.map((node) => node.id),
        )
        .set('lastActiveAt', now)
        .execute();
    }

    for (const nodeEntity of similarNodes) {
      const activation = (1 - nodeEntity.distance) * 0.2 + 0.8;
      const node = new NetworkNode({ ...nodeEntity, lastActiveAt: now }, activation);
      this.nodes.set(nodeEntity.id, node);
      this.activatedNodes.set(nodeEntity.id, node);
    }
  }

  async updateActivation(): Promise<void> {
    const now = new Date();

    await this.updateActivatedEdges(now);

    const activatedNodes = this.activatedNodes.values().map((n) => ({ id: n.id, activation: n.activation }));
    this.activatedNodes.clear();

    const maxDepth = 3;
    for (const node of activatedNodes) {
      if (node.activation > 0.1) {
        await this.spreadNodeActivation([node.id], node.activation, now, maxDepth - 1);
      }
    }

    const deactivatedNodes: number[] = [];
    for (const node of this.nodes.values()) {
      node.activation *= 0.5;
      if (node.activation < 0.1) {
        deactivatedNodes.push(node.id);
      }
    }
    for (const id of deactivatedNodes) {
      this.nodes.delete(id);
    }
  }

  private async updateActivatedEdges(now: Date): Promise<void> {
    const nodes = this.nodes.values().toArray();
    for (let i = 0; i < nodes.length; i++) {
      const node1 = nodes[i];
      if (node1.activation < 0.4) {
        continue;
      }

      for (let j = i + 1; j < nodes.length; j++) {
        const node2 = nodes[j];
        if (node2.activation < 0.4) {
          continue;
        }

        const edgeEntity = await this.db
          .selectFrom('edges')
          .selectAll()
          .where((eb) =>
            eb.or([
              eb('node1Id', '=', node1.id).and('node2Id', '=', node2.id),
              eb('node1Id', '=', node2.id).and('node2Id', '=', node1.id),
            ]),
          )
          .limit(1)
          .executeTakeFirst();

        if (edgeEntity) {
          await this.db
            .updateTable('edges')
            .set({
              activeCount: edgeEntity.activeCount + 1,
              lastPropagationAt: now,
            })
            .where('id', '=', edgeEntity.id)
            .execute();
        } else {
          const similarity = await this.db
            .selectFrom('nodes as n1')
            .innerJoin('nodes as n2', 'n1.id', 'n1.id')
            .select([sql<number>`${sql.ref('n1.embedding')} <=> ${sql.ref('n2.embedding')}`.as('distance')])
            .where('n1.id', '=', node1.id)
            .where('n2.id', '=', node2.id)
            .executeTakeFirstOrThrow();

          await this.db
            .insertInto('edges')
            .values({
              node1Id: node1.id,
              node2Id: node2.id,
              activeCount: 1,
              similarity: 1 - similarity.distance,
              createdAt: now,
              lastPropagationAt: now,
            })
            .execute();
        }
      }
    }
  }

  private async spreadNodeActivation(
    nodePath: number[],
    activation: number,
    now: Date,
    leftDepth: number,
  ): Promise<void> {
    const nodeId = nodePath[nodePath.length - 1];

    const [edges1, edges2] = await Promise.all([
      this.db.selectFrom('edges').selectAll().where('node1Id', '=', nodeId).execute(),
      this.db.selectFrom('edges').selectAll().where('node2Id', '=', nodeId).execute(),
    ]);
    const edges = edges1
      .map((e) => ({ edge: e, target: e.node2Id }))
      .concat(edges2.map((e) => ({ edge: e, target: e.node1Id })));

    const maxActiveCount = Math.max(...edges.map((e) => e.edge.activeCount));

    await this.db
      .updateTable('edges')
      .where(
        'id',
        'in',
        edges.map((e) => e.edge.id),
      )
      .set('lastPropagationAt', now)
      .execute();

    for (const { edge, target } of edges) {
      if (nodePath.includes(target)) {
        continue;
      }

      const similarityScore = edge.similarity * 0.1 + 0.9;
      const activeCountScore = (edge.activeCount / maxActiveCount) * 0.5 + 0.5;
      const nextActivation = activation * similarityScore * activeCountScore;

      let targetNode = this.nodes.get(target);
      if (targetNode) {
        if (targetNode.activation < nextActivation) {
          targetNode.activation = nextActivation;
        }
      } else {
        const nodeEntity = await this.db
          .selectFrom('nodes')
          .selectAll()
          .where('id', '=', target)
          .executeTakeFirstOrThrow();
        targetNode = new NetworkNode(nodeEntity, nextActivation);
        this.nodes.set(target, targetNode);
      }

      if (leftDepth > 0 && targetNode.activation > 0.1) {
        await this.spreadNodeActivation([...nodePath, target], nextActivation, now, leftDepth - 1);
      }
    }
  }

  async getActivatedNodes(topK: number): Promise<NetworkNode[]> {
    return this.nodes
      .values()
      .toArray()
      .toSorted((a, b) => b.activation - a.activation)
      .values()
      .filter((n) => n.activation > 0.2)
      .take(topK)
      .toArray();
  }
}

export class NetworkNode {
  constructor(
    private readonly entity: NodeEntity,
    public activation: number,
  ) {}

  get id(): number {
    return this.entity.id;
  }

  get memory(): string {
    return this.entity.memory;
  }

  get createdAt(): Date {
    return this.entity.createdAt;
  }

  get lastActiveAt(): Date {
    return this.entity.lastActiveAt;
  }
}
