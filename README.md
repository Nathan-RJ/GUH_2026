# GUH_2026

## Running the app

Needs Python 3.10+ and Node 18+. From this folder, in bash (Git Bash on Windows):

```bash
./dev.sh
```

Then open http://localhost:5173. The first run sets everything up (Python venv + packages).
Ctrl+C stops both the backend and frontend. Details in `backend/README.md` and `frontend/README.md`.

---

Hi Alex is here

Hi Kardi is here

Hi Nathan is here


- 2 player argument given opposing statements, reason to which is right

- Rapid fire explanations on a given prompt.
Use semantic reasoning to determine which answers are better, why or why not. Using voice through eleven labs

- Get given the prompt, have to explain in sufficient detail.
Agent goes back and forth with you until its happy, trying to get you to explain deeper and more clearly.

- Imposter style game?
2 correct statements, one incorrect.
Have to reason through and find which is the false statement.



# (Reply) 2 Me
is a flight simulator for learning by teaching. Students teach a confused AI student that only knows what they tell it, and is marked against their lecturer's real rubric.
The university problem
• Students revise passively by rereading and highlighting, and only discover their gaps in the exam.
• Lecturers find out what the cohort misunderstood after marking, when it's too late to reteach.
• Existing Feynman-style apps grade explanations against generic AI knowledge, not against what a specific module teaches and how it is marked.
The fix: the lecturer's own module content and rubric become a hidden answer key. Students prove understanding by teaching it, and lecturers see cohort-wide misconceptions while there is still time to address them.
How it works
Lecturer side
1. Uploads module content (slides, notes), past exam papers and the marking rubric.
2. The system builds a concept map of the module and a bank of realistic misconceptions for each topic.
3. Uploaded exam content and the rubric stay hidden from students at all times.
4. A dashboard shows which misconceptions the cohort struggles to fix, plus any sessions escalated for review.
Student side
1. Picks a topic from the module.
2. Meets an AI student seeded with misconceptions from that topic's bank. It knows nothing beyond what the student teaches it.
3. Teaches it out loud or by typing. The AI student asks naive follow-up questions and holds onto its misconceptions until they are properly explained away.
4. Watches the AI student's concept map update live: misconceptions show red, then turn green once fixed.
5. At the end, the AI student sits a short exam built from the lecturer's content and is marked against the hidden rubric. Its mark is the student's score.
6. Gets feedback: misconceptions left unfixed, concepts never covered and where explanations were vague. All feedback stays at topic level so no exam questions are revealed.


----------

As you talk to it:
Your responses appear on the page,
coloured (red -> green?) based on rating of how good the topic has been covered.
I.e. you talk to it about bubble sort, cards pop up with titles of something like 
"complexity theory reasoning" and coloured based on how well you explained it,
"logical process" and how well thats been covered
Basically whatever the student is still confused on shows up in red,
what it has understood well is in green.
The examiner will talk to the studnet behind the scenes about it and rate how well it understood.
