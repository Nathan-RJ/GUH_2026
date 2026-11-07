// Voice: talk to the student (mic -> text) and hear replies (text -> speech).
// Everything voice-related lives in this folder; pages just import from here.
//
//   <MicButton onTranscript={send} />    record, transcribe, hand back the text
//   <SpeakButton text={reply} />         play one message out loud
//   <AutoSpeak messages={messages} />    toggle: read every new reply aloud
import "./voice.css";

export { MicButton } from "./MicButton";
export { SpeakButton } from "./SpeakButton";
export { AutoSpeak } from "./AutoSpeak";
export { play as speakText, stop as stopSpeaking } from "./player";
