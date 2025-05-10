CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE nodes (
  "id" serial PRIMARY KEY,
  "memory" text NOT NULL,
  "embedding" vector(1024) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "lastActiveAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_nodes_embedding ON nodes USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE edges (
  "id" serial PRIMARY KEY,
  "node1Id" integer NOT NULL REFERENCES nodes ("id"),
  "node2Id" integer NOT NULL REFERENCES nodes ("id"),
  "activeCount" integer NOT NULL,
  "similarity" float NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "lastPropagationAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_edges_node1 ON edges ("node1Id");
CREATE INDEX idx_edges_node2 ON edges ("node2Id");
