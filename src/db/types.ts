import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
  nodes: NodeTable;
  edges: EdgeTable;
}

export interface NodeTable {
  id: ColumnType<number, never, never>;
  memory: string;
  embedding: ColumnType<never, string, string | undefined>;
  createdAt: Generated<Date>;
  lastActiveAt: Generated<Date>;
}

export interface EdgeTable {
  id: ColumnType<number, never, never>;
  node1Id: number;
  node2Id: number;
  activeCount: number;
  similarity: number;
  createdAt: Generated<Date>;
  lastPropagationAt: Generated<Date>;
}

export type NodeEntity = Selectable<NodeTable>;
export type NewNode = Insertable<NodeTable>;
export type NodeUpdate = Updateable<NodeTable>;

export type EdgeEntity = Selectable<EdgeTable>;
export type NewEdge = Insertable<EdgeTable>;
export type EdgeUpdate = Updateable<EdgeTable>;
