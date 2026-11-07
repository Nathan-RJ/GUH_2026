// Helpers for working with several modules (each with its own topics).
import type { Module, Topic } from "./types";

export function findTopic(modules: Module[], topicId: string): { module: Module; topic: Topic } | null {
  for (const module of modules) {
    const topic = module.topics.find((t) => t.id === topicId);
    if (topic) return { module, topic };
  }
  return null;
}
