# Trainer text program

Use this program for every `/import-instagram-trainers` profile. It governs the preparation of `sourceDescription`, `resolved.presentation`, `resolved.training`, their quotes, and `pinned[].textRole`.

The goal is not to generate catalog filler. The goal is to prepare an editable draft that sounds like this trainer and preserves useful detail from their own material.

## Output

The program produces two public text fields:

- `presentation` — useful material about the trainer, their approach, experience, audience, and outcomes.
- `training` — only material that explains how a session works.

It also produces:

- `presentationMode`: `source` or `adapted`;
- `presentationQuotes` and `trainingQuotes`;
- one `textRole` for every pinned post;
- structured facts such as sport, audience, format, experience, place, price, and contacts.

## Stage 1 — Capture every text source

Keep the exact text before editing it.

1. Primary supplied description:
   - CSV: copy the complete `description` cell into raw `sourceDescription`;
   - operator prose: keep it verbatim in `operatorNotes`;
   - ordinary Instagram import: keep the expanded biography in `resolved.sourceBio`.
2. Copy every about-highlight frame into `aboutFrames`.
3. For each pinned post, store the complete caption and read every visible carousel slide into `imageText`, one slide per string.
4. Read attached Threads biography and posts.
5. Keep structured facts from the operator separately. Do not merge them into the primary description.

Do not summarize during capture. Do not drop a repeated-looking line until all sources are classified.

## Stage 2 — Inspect pinned posts as documents

Pinned posts are often the richest source. Open all marked pins, up to three, even when their cover is a reel or a text card.

For each pin:

1. Read the cover, caption, and every opened slide.
2. Look for headings and meaning, not only exact titles:
   - about: «Обо мне», «О себе», «Давайте знакомиться», «Мой путь», «Кто я»;
   - training: «Как проходят тренировки», «Как я работаю», «Формат занятий», «Что будет на тренировке», «Мой подход»;
   - facts: education, achievements, audience, experience, price, schedule, place;
   - promotion: giveaway, discount, booking call, hashtags, event announcement.
3. Assign `pinned[].textRole`:
   - `about` — the caption or slides describe the trainer, their path, approach, or professional identity;
   - `training` — they explain session structure, methods, load, exercise selection, technique work, feedback, or progression;
   - `facts` — useful structured facts, but no reusable narrative;
   - `promotion` — primarily sales, booking, giveaway, announcement, or hashtags;
   - `none` — no useful text.
4. A mixed post takes the strongest reusable role. Promotion around a substantial about/training passage does not erase that passage; remove the promotional wrapper later.
5. A text slide is not a gallery photo. Its words still belong in `imageText`.

Only `about` and `training` captions may support public card prose. Every role may still fill structured fields.

## Stage 3 — Build an evidence ledger

Before writing, make a small internal ledger. Each item has an exact quote, source, and destination.

Destinations:

- identity and positioning;
- approach and principles;
- experience and achievements;
- audience and level;
- outcomes the trainer explicitly promises or describes;
- session process;
- sports coached versus practiced;
- formats, place, price, languages, and contacts;
- personal context that helps explain the trainer;
- promotion or interface noise to discard.

Do not convert an implication into a fact. «Тренирую давно» does not become a number. «Запись на тренировки» does not describe a session.

When sources conflict:

1. explicit operator fact wins for its single-value field;
2. supplied CSV description wins over the Instagram biography as the primary narrative;
3. a detailed recent about/training source wins over a short profile slogan for prose;
4. unresolved factual conflicts stop that field instead of choosing silently.

## Stage 4 — Identify the trainer's voice

Record the voice before drafting:

- point of view: first person, third person, or neutral;
- tone: restrained, energetic, expert, warm, direct;
- characteristic phrases worth keeping;
- sentence rhythm: short statements, explanatory paragraphs, or lists;
- words the trainer uses for clients, sessions, and results.

Keep that voice. Do not translate everyone into the same first-person catalog style. Do not insert enthusiasm, promises, or professional terminology the trainer did not use.

## Stage 5 — Choose the presentation mode

Choose `source` when the primary description or an about pin is already coherent and useful.

In `source` mode:

- keep all meaningful sentences and their order;
- retain distinctive wording and point of view;
- remove only contacts, hashtags, Instagram UI, repeated headings, duplicated lines, and booking calls;
- combine line wraps that are only layout;
- do not prepend a generated introduction.

Choose `adapted` when the material is fragments, labels, duplicated scrape text, or several complementary sources.

In `adapted` mode:

- lead with the strongest concrete idea, not metadata;
- combine related facts into readable paragraphs;
- keep characteristic source phrases;
- remove repetition and promotion;
- preserve point of view when possible;
- do not force the name, sport, or city into the first sentence;
- do not invent transitions that add meaning.

If the source contains only a few useful words, write a short text. Do not pad it.

## Stage 6 — Compose «Как меня представить»

Use this priority:

1. coherent `sourceDescription`;
2. coherent profile biography;
3. pinned `about` caption and its `imageText`;
4. about highlight;
5. Threads about text;
6. operator prose;
7. grounded fragments from the evidence ledger.

A strong presentation usually answers some of these, not necessarily all:

- what this trainer helps with;
- who they work with;
- what is distinctive about their approach;
- relevant professional path or achievement;
- what outcome or experience they focus on.

The name, headline, sports, city, formats, and audiences already appear elsewhere. Repeat them only when they belong naturally to the trainer's own text.

## Stage 7 — Compose «Как проходят мои тренировки»

Fill `training` only from evidence that explains process:

- how a session starts or is structured;
- how technique and mistakes are handled;
- how load, exercises, or a program are selected;
- how individual and group work differ;
- how progress and feedback are organized;
- what happens during warm-up, main work, sparring, or recovery.

Preferred sources:

1. pinned post with `textRole: training`;
2. training process in `imageText`;
3. about highlight;
4. primary description;
5. Threads;
6. operator prose.

These are not process descriptions and stay out:

- «персональные и групповые тренировки»;
- «запись открыта»;
- an address or hall;
- a sport list;
- price or schedule;
- generic «индивидуальный подход» without an explanation.

Leave `training` empty when no process is stated.

## Stage 8 — Ground every statement

For every sentence in the draft, answer:

1. Which exact quote supports it?
2. Did the draft preserve the fact's scope and certainty?
3. Did the draft keep coaching separate from personal practice?
4. Did it introduce a result, method, audience, city, experience, or benefit not stated?

Put the supporting slices into `presentationQuotes` or `trainingQuotes`. A quote from a pinned caption is allowed only when that post has `textRole: about` or `training`.

Numbers must match exactly. Do not turn medals, education, or personal athletic experience into coaching experience.

## Stage 9 — Remove mechanical and promotional noise

Remove:

- follower/post counts and Instagram controls;
- hashtags and repeated category labels;
- contact details already stored in contact fields;
- links and @mentions;
- «пишите в директ», «запись по ссылке», giveaways, discounts, and urgency;
- duplicate headings and repeated sentences.

Do not remove a meaningful phrase merely because it is informal or emotional.

## Stage 10 — Human edit

Read the result aloud and revise it when any answer is yes:

- Could the same paragraph be pasted onto fifty other trainers?
- Does it begin with «Я … тренер … в городе» without that exact source line?
- Does it repeat the headline and city but add no useful detail?
- Does it sound like a database record or a résumé list?
- Are three short source phrases stretched into several empty sentences?
- Was a booking call mistaken for training content?
- Did adaptation erase a distinctive phrase?

Prefer concrete source detail over polished generic language.

## Stage 11 — Final quality gate

Before writing `resolved`:

- `sourceDescription` is exact when supplied;
- every pin has a `textRole`;
- all about/training slides were read into `imageText`;
- `presentationMode` matches the amount of rewriting;
- `presentation` contains no invented claim;
- `training` explains process or is empty;
- quotes support every substantive statement;
- contacts and promotion are removed from public prose;
- the text does not duplicate metadata for padding;
- the result sounds like one identifiable trainer.

If a check fails, revise the draft before `save-draft.ts`. Do not weaken the evidence or mislabel a promotional post to make validation pass.

## Example

Source fragments:

```text
Помогаю укрепить спину и улучшить осанку
Онлайн-тренировки дома
Персональные тренировки
Запись в Direct
```

Bad:

```text
Я Наталья, фитнес-тренер в Минске. Веду онлайн- и персональные тренировки.
```

Grounded adaptation:

```text
Помогаю укрепить спину и улучшить осанку. Можно заниматься онлайн дома или персонально.
```

`training` stays empty because the source names formats but does not explain the session process.
