// Helpers for working with several modules (each with its own topics).
import type { Module, Topic } from "./types";

export function findTopic(modules: Module[], topicId: string): { module: Module; topic: Topic } | null {
  for (const module of modules) {
    const topic = module.topics.find((t) => t.id === topicId);
    if (topic) return { module, topic };
  }
  return null;
}

/**
 * Uploaded lessons grouped into modules by their upload title (topic.module),
 * case-insensitively, in the order they first appear.
 */
export function groupIntoModules(topics: Topic[]): Module[] {
  const modules = new Map<string, Module>();
  for (const topic of topics) {
    const title = topic.module?.trim() || "Other lessons";
    const key = title.toLowerCase();
    let module = modules.get(key);
    if (!module) {
      module = { id: `uploaded-${key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "module"}`, title, code: "", topics: [] };
      modules.set(key, module);
    }
    module.topics.push(topic);
  }
  return [...modules.values()];
}
