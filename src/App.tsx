import {
  DbProvider,
  EnsureDbLoaded,
  IDbBackend,
  IInitDbClientConfig,
  IQuery,
  IQueryResult,
  migrationsPlugin,
  reactiveQueriesPlugin,
} from "@trong-orm/react";
import React from "react";
import SQLite from "tauri-plugin-sqlite-api";

import { List } from "./List";
import { createNotesTableMigration } from "./migrations/createNotesTable";

const tauriBackend =
  (path: (dbName: string) => string): IDbBackend =>
  ({ dbName, stopped$ }) => {
    let db: SQLite | undefined = undefined;

    return {
      async initialize() {
        db = await SQLite.open(path(dbName));

        stopped$.subscribe(() => {
          if (!db) {
            console.error("Failed to stop DB‚ it is not initialized");

            return;
          }

          // TODO: how to close db?
        });
      },
      async execQueries(
        queries: IQuery[],
        opts: {
          log: {
            suppress: boolean;
            transactionId?: string;
          };
        }
      ) {
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }

        const result: IQueryResult[] = [];

        for (const q of queries) {
          const startTime = performance.now();

          result.push(await db.select<IQueryResult>(q.text, q.values));

          const end = performance.now();

          if (!opts.log.suppress) {
            console.info(
              `[${dbName}]${
                opts.log.transactionId
                  ? `[tr_id=${opts.log.transactionId.slice(0, 6)}]`
                  : ""
              } ` +
                queries.map((q) => q.text).join(" ") +
                " Time: " +
                ((end - startTime) / 1000).toFixed(4)
            );
          }
        }

        return result;
      },
    };
  };

const config: IInitDbClientConfig = {
  dbName: "helloWorld",
  dbBackend: tauriBackend((dbName) => `${dbName}.db`),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

export const App = () => {
  return (
    <DbProvider config={config}>
      <EnsureDbLoaded fallback={<div>Loading db...</div>}>
        <List />
      </EnsureDbLoaded>
    </DbProvider>
  );
};
