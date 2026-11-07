import type { CohortCounts, ConceptState, Escalation, Misconception, Module } from "./types";

export const DEMO_MODULE: Module = {
  id: "intro-prog",
  title: "Introduction to Programming",
  code: "CS101",
  topics: [
    {
      // A real lesson from the n8n Prepare Lesson workflow: marked live by Mark Session.
      // Concept ids are its rubric's criterion ids.
      id: "bubble-sort",
      title: "Bubble sort",
      summary: "Sorting a list by comparing neighbours, swapping, and repeating passes.",
      lessonId: "b0454456-7c09-4401-a544-373e3bbc2f10",
      concepts: [
        { id: "adjacent_comparisons", label: "Comparisons" },
        { id: "conditional_swaps", label: "Swaps" },
        { id: "repeated_passes", label: "Repeated passes" },
        { id: "stopping_conditions", label: "Stopping" },
      ],
    },
    {
      id: "recursion",
      title: "Recursion",
      summary: "Functions that solve a problem by calling themselves on smaller inputs.",
      concepts: [
        { id: "base_case", label: "Base case" },
        { id: "recursive_case", label: "Recursive case" },
        { id: "call_stack", label: "Call stack" },
        { id: "stack_overflow", label: "Stack overflow" },
        { id: "rec_vs_iter", label: "Recursion vs iteration" },
      ],
    },
    {
      id: "variables",
      title: "Variables & Types",
      summary: "Storing values, naming them, and what kinds of data they hold.",
      concepts: [
        { id: "assignment", label: "Assignment" },
        { id: "primitive_types", label: "Primitive types" },
        { id: "type_conversion", label: "Type conversion" },
        { id: "scope", label: "Scope" },
      ],
    },
    {
      id: "loops",
      title: "Loops",
      summary: "Repeating work with for and while, and knowing when to stop.",
      concepts: [
        { id: "for_loop", label: "For loop" },
        { id: "while_loop", label: "While loop" },
        { id: "loop_condition", label: "Loop condition" },
        { id: "infinite_loop", label: "Infinite loop" },
      ],
    },
    {
      id: "functions",
      title: "Functions",
      summary: "Packaging logic with parameters and return values.",
      concepts: [
        { id: "parameters", label: "Parameters" },
        { id: "return_values", label: "Return values" },
        { id: "side_effects", label: "Side effects" },
        { id: "reuse", label: "Reuse & abstraction" },
      ],
    },
  ],
};

// Hidden rubric used by the mock grader: keyword groups the explanation must hit.
export interface RubricEntry {
  groups: string[][]; // each group = synonyms; hitting every group = correct
  wrong?: { pattern: RegExp; severity: "very_wrong" | "slightly_wrong"; note: string }[];
  correctNote: string;
  partialNote: string;
}

export const RUBRIC: Record<string, RubricEntry> = {
  base_case: {
    groups: [["base case", "stopping", "stop condition", "terminat"], ["stop", "without recurs", "no further", "directly", "return"], ["must", "need", "required", "always have", "otherwise", "forever", "infinite"]],
    wrong: [
      { pattern: /base case (is )?(optional|not (needed|necessary|required))/i, severity: "very_wrong", note: "Claimed the base case is optional." },
      { pattern: /base case .*(start|first line|beginning)/i, severity: "slightly_wrong", note: "Confused the base case with the start of the function." },
    ],
    correctNote: "Explained that every recursive function needs a base case that returns without recursing.",
    partialNote: "Mentioned stopping, but not why the base case is essential.",
  },
  recursive_case: {
    groups: [["recursive case", "calls itself", "call itself", "calling itself"], ["smaller", "simpler", "reduc", "n - 1", "n-1", "closer"]],
    wrong: [{ pattern: /same (input|problem|size)/i, severity: "slightly_wrong", note: "Suggested calling with the same input." }],
    correctNote: "Explained the function calls itself on a smaller version of the problem.",
    partialNote: "Said it calls itself, but not that the problem must get smaller.",
  },
  call_stack: {
    groups: [["call stack", "stack frame", "frames", "stack"], ["push", "added", "on top", "each call"], ["pop", "return", "unwind", "removed"]],
    wrong: [{ pattern: /(queue|first in first out|fifo)/i, severity: "slightly_wrong", note: "Described the call stack as a queue." }],
    correctNote: "Described frames being pushed per call and popped on return.",
    partialNote: "Mentioned the stack but missed how frames are pushed and popped.",
  },
  stack_overflow: {
    groups: [["stack overflow", "overflow"], ["too many", "too deep", "runs out", "memory", "limit", "no base case", "never stops"]],
    wrong: [{ pattern: /overflow .*(website|forum)/i, severity: "very_wrong", note: "Confused stack overflow with the website." }],
    correctNote: "Linked stack overflow to too many frames, e.g. a missing base case.",
    partialNote: "Named stack overflow without explaining its cause.",
  },
  rec_vs_iter: {
    groups: [["loop", "iteration", "iterative"], ["not always", "slower", "overhead", "more memory", "depends", "either", "can be rewritten", "convert"]],
    wrong: [{ pattern: /recursion (is )?(always )?faster/i, severity: "very_wrong", note: "Claimed recursion is always faster than loops." }],
    correctNote: "Explained recursion isn't inherently faster and has call overhead.",
    partialNote: "Compared with loops but didn't address performance or trade-offs.",
  },
};

export const SAM_MISCONCEPTIONS: Record<string, { concept: string; belief: string; fixed: string }[]> = {
  recursion: [
    { concept: "base_case", belief: "Honestly I think the base case is optional? Like, the function will just figure out when to stop.", fixed: "Ohh. So without a base case it just keeps calling itself forever. Base case is mandatory, got it!" },
    { concept: "rec_vs_iter", belief: "Wait, but recursion is always faster than loops though, right? It looks so much cleverer.", fixed: "Right, so recursion has extra overhead from all those calls. It's not automatically faster. Fair enough." },
  ],
};

export const SEED_BEST: Record<string, ConceptState> = {
  recursion: "slightly_wrong",
  variables: "correct",
  loops: "partial",
  functions: "not_covered",
};

export const SEED_COHORT: Record<string, CohortCounts> = {
  recursion: { correct: 18, partial: 31, slightly_wrong: 22, very_wrong: 14, not_covered: 9 },
  variables: { correct: 52, partial: 28, slightly_wrong: 7, very_wrong: 3, not_covered: 4 },
  loops: { correct: 37, partial: 33, slightly_wrong: 12, very_wrong: 5, not_covered: 7 },
  functions: { correct: 26, partial: 30, slightly_wrong: 11, very_wrong: 6, not_covered: 21 },
};

export const SEED_MISCONCEPTIONS: Misconception[] = [
  { topicTitle: "Recursion", percent: 41, text: "think the base case is optional" },
  { topicTitle: "Recursion", percent: 34, text: "believe recursion is always faster than loops" },
  { topicTitle: "Loops", percent: 22, text: "confuse the loop condition with the loop counter" },
  { topicTitle: "Variables & Types", percent: 17, text: "assume variables declared in a function are visible everywhere" },
];

export const SEED_ESCALATIONS: Escalation[] = [
  { id: "esc-1", student: "Priya Shah", topicId: "recursion", topicTitle: "Recursion", reason: "Repeatedly taught an incorrect fact", at: "Today, 10:42", reviewed: false },
  { id: "esc-2", student: "Tom Okafor", topicId: "functions", topicTitle: "Functions", reason: "Tried to make the AI student award itself marks", at: "Yesterday, 16:05", reviewed: false },
];

export const DEMO_SCRIPTS: Record<string, string[]> = {
  recursion: [
    "Recursion is when a function calls itself to solve a problem.",
    "The base case is optional really, it's just there for tidiness.",
    "Actually no, I was wrong. The base case is the stopping condition — it returns directly without recursing, and every recursive function must have one, otherwise it calls itself forever.",
    "In the recursive case, the function calls itself on a smaller version of the problem, like factorial of n - 1, so it gets closer to the base case each time.",
    "Every call gets pushed on the call stack as a new frame, and when a call returns its frame is popped off.",
    "If there are too many calls, for example no base case, the stack runs out of memory and you get a stack overflow.",
    "Recursion is not always faster than a loop. Each call has overhead and uses more memory, and any recursive solution can be rewritten as iteration.",
  ],
};

export const SEED_STUDENT_NAMES = [
  "Priya Shah", "Tom Okafor", "Amelia Hughes", "Oliver Bennett", "Zara Ahmed", "Jack Murphy",
  "Isla Campbell", "Noah Williams", "Freya Patel", "Harry Evans", "Sofia Rossi", "Leo Thompson",
];
