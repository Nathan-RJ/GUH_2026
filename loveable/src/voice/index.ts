// Student voice: ElevenLabs through the Flask backend, with the browser's own
// speech as a fallback. See use-student-voice.ts.
export { useStudentVoice, type VoiceEngine } from "./use-student-voice";
export { voiceAvailable } from "./api";
export { STUDENTS, blobColours, findStudent, randomStudent, type StudentType } from "./students";
