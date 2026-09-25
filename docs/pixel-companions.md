# Pixel companions

Open **Companions** in the top toolbar, or **Garden → Companions**. In the
desktop app, choose **Bring to desktop** for a transparent, always-on-top
companion. Its compact view shows the pixel character and any idle activity,
without a persistent header, name, status, timer or footer. Click the companion
to interact, or hold and drag its body to move the desktop window. Dragging
does not also trigger an interaction.

Hover over the companion or use **Tab** to reveal six icon controls: food,
play, sleep, focus, size and panel. Tooltips and accessible names describe each
control. Humanoids share meals, hang out and rest; creatures eat, play and
sleep. The **Pet size** control opens a 70–180% size slider and a reset button.
The character and its native window resize together; size and position are
saved for the next launch.

Reaction and reminder bubbles appear briefly when needed. Open **Panel** for
the full care, collection and chat controls, then collapse it to return to the
minimal view. The expanded panel's × button hides the companion; the tray menu
can bring it back. Closing the main workspace to the tray keeps the companion
running; quitting Tracer stops both windows.

## Collection

| Companion | Unlock |
| --- | --- |
| Sprout, cloud sheep | Available from the start |
| Miso, ginger cat | Harvest 50 crops in the farm |
| Brook, river penguin | Catch 10 fish |
| Ember, fox | Complete 10 distinct tasks |
| Luna, moon rabbit | Complete tasks on 3 consecutive local calendar days |
| Nova, starlight dragon | Accumulate 120 focus minutes |

Each earned companion has its own personality, care reactions and preferred
quiet activities. Sprout is a patient gardener; Miso is a playful food critic;
Brook is a careful mapmaker; Ember is a resourceful scout; Luna is a reflective
herb lover; Nova is an enthusiastic apprentice inventor. Open the personality
card in **Care** to read their story, favorite things and small rituals. The
same profile guides their AI conversation style.

Their heads, paws, feet, ears, tails and wings move independently where the
species has those parts. Different silhouettes, gestures and timing distinguish
the companions during care, focus, dragging and quiet activities. Each of the
six earned companions has 16 image frames for each of the 16 behaviors,
including intermediate poses between the main gestures. Reduced-motion
settings pause these movements. Personality text does not add a persistent
bubble to the minimal desktop view.

Existing farm progress, task completion history and focus minutes count.
Re-completing the same task does not inflate the distinct-task achievement.
A streak may include yesterday until today's first completion. Unlocks are
permanent even if a streak ends or a project is subsequently deleted.

## Create your own companion

Open **Collection → Create from a photo**, choose a photo, name the companion,
and choose **Humanoid** or **Creature**. Personality is optional: a short
description can guide the generated appearance and how the companion chats.
Humanoids share meals, hang out and rest; creatures eat, play and sleep.
The selected type also guides the AI's body shape and conversational behavior.

Generation requests high-quality, detailed pixel art that preserves visible
features from the reference: face shape, hairstyle, glasses, clothing, colors
or an animal's markings. **Distinctive features to keep** is an optional field
of up to 400 characters for emphasizing the details that matter to you. This
guidance is used for image generation only, not as chat personality.

New companions have 16 behaviors with 16 image frames each: idle, petting,
eating, playing, sleeping, waking, focusing, dragging, fishing, exercise,
gardening, mining, reading, writing, crafting and tea breaks: 256 frames in
total. Generation makes one transparent sprite sheet per behavior, containing
16 chronological poses and their transitions. The later sheets use the first
sheet as an identity reference. The player displays one frame at a time in
both the workspace and desktop, with shorter intervals during a gesture and
longer pauses when resting. Each frame keeps a transparent margin so neighboring
poses and props stay outside the visible frame.

For the closest resemblance, use a clear photo with one main subject and
choose the matching type: **Humanoid** for a person or human-shaped character,
**Creature** for an animal or other creature. Changing the subject's form can
reduce resemblance. The image model interprets the photo, so exact likeness
is not guaranteed. Compare the reference and generated previews before saving;
you can revise the distinctive features or generate another version.

**Generate with** defaults to **ChatGPT subscription**, using the account
signed in through **AI plan → My AI** and the local Codex image-generation
capability. Availability depends on the account and runtime; generation uses
the account's available allowance for each of the 16 generation requests.
If image generation is unavailable or the
allowance is exhausted, the request stops with an explanation. It does not
purchase credits or switch to a personal API automatically.

You can explicitly select **Personal API** to use the provider configured
in **My AI** instead. That provider must support image editing; an image model
can be selected in the creation form. This option has separate API billing.

Choosing a photo does not send it anywhere. **Generate** sends the photo,
name, type, optional personality and distinctive features through the selected
connection. Review the paired reference and generated
previews and use the **Action** selector to inspect every behavior. Once all
16 behaviors are ready, choose **Save & bring to life** to add the companion
to the collection. Failed requests keep the photo, form values and completed
groups; retry continues with the missing groups. **Start over** asks for
confirmation before clearing a partial result, keeps your photo and settings,
and makes no request until you choose Generate. **Regenerate all actions**
also requires confirmation. The primary button on a complete result opens
the preview without generating again. Up to 12 custom
companions can be saved on this device.

The app checks sheet dimensions, transparency, populated frames, clear frame
boundaries and at least 12 distinct poses in each 16-frame behavior before
accepting a sheet. Repeated images or shifted copies do not qualify as new
poses. These checks do not guarantee
likeness or the quality of every action; review the preview before saving.
Reduced-motion mode holds the first frame of the current behavior. Previously
saved single-image companions and four-frame animation packs continue to work
with their original artwork. To give a previously generated companion the new
intermediate poses, generate a new complete pack from its reference photo.

Closing the creation panel, pressing Escape or clicking its backdrop only
minimizes it. Generation continues, and a progress bar in the navigation area
shows completed actions out of 16. Click it to return to the same draft.
Completion reopens the preview automatically. If another editor is open,
the ready indicator remains visible and the preview opens after that editor
closes. Closing an unsaved result displays a reminder; it does not discard it.

The resized reference photo, settings and completed action URLs are backed up
in a local IndexedDB draft, including before paid generation starts and after
each accepted action. Reloading or restarting restores that draft. Incomplete
drafts require an explicit **Continue generation** click; the app never starts
new paid work merely because it reopened. Requests use stable IDs so a
reconnected page can retrieve a completed server result without generating it
again. Force-quitting the entire application can interrupt an action that has
not finished; already checkpointed actions remain available.

Saving the companion removes the local recovery draft and its reference
photo. **Discard draft** removes it only after confirmation. Storage failures
leave the in-memory preview available and display a warning to keep the app
open. Choosing a photo or backing up a draft does not upload it anywhere.
Generated artwork is stored locally
in the app's data directory; companion names, personality, type and care
state are stored in this device's preferences. Custom companions can use
the same focus timer, task reminders and desktop window as earned companions.

## Share a companion

In **Collection**, select a custom companion and choose **Export current
companion**, then **Download companion file**. Send the `.tracer-pet` file to
a friend. It contains the name, type, personality and every PNG image or
animation sheet, including the quiet work routines. It does not depend on the
sender's local paths or AI account. Source photos, chat, account credentials,
tasks, needs and bond progress are not included; PNG text metadata is removed.

The recipient chooses **Collection -> Import companion**, selects the file,
reviews the portrait and profile, then chooses **Import to collection**. Both
devices need a Tracer version with these controls. Import, care and animation
playback work without GPT or an API key; AI chat still requires the recipient's
own connection. The desktop collection opens these operations in the main window.

Imports begin with fresh care progress. Importing the same package again opens
the already-imported companion and keeps its progress. Imported companions can
also be exported to share again. Static portraits, older four-frame packs and
new 16-frame packs are supported. Built-in achievement companions retain
their unlock rules and do not have an export command.

Packages are limited to 257 MB and 12 custom companions per device. Preview
checks the format, image checksums and usable animation frames before adoption;
it does not write artwork. Unsupported, incomplete or damaged files report an
error and leave the collection intact. Failed artwork writes remove files from
that import; retrying a failed preference save reuses the artwork already saved.

## Care and focus

Each selected companion has its own food, energy, joy and bond values.
Food and joy slowly decline over time; sleep restores energy. Feeding and
playing improve its needs and bond. Play costs energy; sleeping companions
need to wake before eating or playing. Short cooldowns prevent accidental
double clicks. Clicking the companion directly improves joy and bond.
Accepted interactions display distinct body animations and props: food while
eating, a toy and sparkles while playing, hearts when petted, and a resting
pose or wake-up stretch. The speech bubble confirms the action. When a
companion is full, asleep, tired, content or briefly cooling down, it explains
why the interaction did not change its needs. These controls work while the
main workspace is hidden to the tray. Time away never kills a pet or removes
earned companions; offline changes are capped at 24 hours per update.

After about twenty quiet seconds, an awake companion with enough food and
energy begins a small activity. Fishing, exercise, gardening and mining each
last about 70 seconds, separated by twenty quiet seconds. Built-in companions
and custom companions with all 16 behaviors alternate these activities with
reading, writing, crafting and tea breaks. The new image sequences include
intermediate poses during the gesture and brief pauses before the action and
during recovery. Older four-frame packs keep their slower timing and original
activities; new artwork requires a new generation with the reference photo. Humanoids use a
fishing rod, weights, gardening tools and a pickaxe. Creatures splash with
their paws, hop and stretch, dig around seedlings, or scratch at shiny rocks.
The pixel props and body movements differ for each type.

These are ambient activities: they do not earn farm resources, unlock rewards,
complete tasks or change needs beyond their normal changes over time. Care,
petting and dragging interrupt them immediately. They pause during sleep,
active focus, task nudges, an open chat panel or low food/energy. After those
conditions clear, the companion waits quietly before starting again. Finishing
a focus round or collapsing the desktop chat panel allows activities to resume.
Reduced-motion settings retain the activity's props without animation.

The timer is the same Pomodoro clock used by the workspace and farm, so
starting or pausing it from either window updates both. Completed rounds
show a break reminder. Task nudges select unfinished tasks scheduled for
today or earlier, or due today or earlier. Nudges are limited to once every
30 minutes and suppressed during focus, sleep or snooze. Reminders can be
disabled; **Quiet for 30 minutes** temporarily silences them. Clicking the
task opens its editor in the main workspace.

## AI chat

Configure a ChatGPT account or your own API in **AI plan → My AI**, then open
the companion's **Chat** tab. It uses the selected connection, without
automatically switching providers. The current conversation, today's local
date, any draft proposal and pet identity are sent, including a custom
companion's name, type and optional personality. Existing workspace tasks,
source photos and files are not sent automatically. Sending can use ChatGPT
allowance or incur API charges. Replies do not execute commands or change the
timer; a task or project proposal requires your explicit confirmation before
it is saved.

Garden companions use the same trusted catalog for their displayed name and
AI identity, including all nine plant species and their shiny variants. Both
AI connections receive the selected plant's localized name, species and shiny
state. They describe a plant spirit rather than inheriting Sprout's sheep
identity. The current profile takes precedence over mistaken names or species
in earlier replies; existing conversation and draft records are preserved.

Press **Enter** to send, or **Shift+Enter** for a new line. Confirming text with
an input method does not send the message. Your sent bubble appears immediately,
the input clears, and a separate thinking bubble shows that a reply is pending.
You can type the next draft while waiting; the Send button waits for the current
request to finish. A reply never clears a newer draft.

If the request fails, the sent bubble stays marked as failed with a **Retry**
button. Retry uses that same message rather than adding another bubble. The
original text is restored in the composer only when you have not entered a
new draft. Sending that restored text also retries the same message.

Each companion has its own locally saved conversation, unsent text and work
proposal. The main window and native desktop window keep separate chat records.
Switching companions restores that companion's record and cancels waiting for
the previous reply, so a slow response cannot appear in the wrong chat.
Closing the panel, opening **Set up My AI**, reloading or restarting retains
the saved record; interrupted messages can be retried. **Clear** removes the
conversation and draft when no creation result is still awaiting confirmation.

Pet care and unlocks are saved in this device's `tracer.pet.v1` preferences;
desktop visibility and position are saved in `pet-window.json` in the app
profile. They are currently local to this device. Chat recovery is held in this
device's local browser storage and can be cleared; it is not part of companion
exports or the workspace task file.
The normal browser version has the same companion home, but transparent
desktop windows require Electron.

### Create tasks or a project through chat (0.3.9)

Ask the companion to organize new work in either the main window or native
desktop chat. It asks for essential missing details before proposing a plan;
dates and effort estimates are optional. Ordinary conversation does not create
work. The proposal preview shows the project and task details before anything
is added to the workspace. Continue chatting to revise it, cancel it, or choose
**Confirm & create** when it is ready.

Confirmation first saves a local recovery record, then writes the proposed
work through the main workspace. A successful save is required before the chat
reports completion. If the result is uncertain, the proposal stays available
and **Retry creation** uses the same request identifier. Resolve that attempt before
revising or canceling it, so a lost reply or repeated click cannot turn it into
a second creation request. Reloading or reopening the app restores the pending
attempt. After successful creation, edit the saved work in the workspace.

Local storage failures display an error and keep available content in the
open panel. Keep the application open until recovery storage works again.

## Verification

- `node dev/qa-companion-work.cjs` checks follow-up questions, proposal previews,
  explicit confirmation, local chat recovery, storage failure protection and
  same-request creation retries in the workspace and compact desktop layout.
  It uses mocked AI responses and isolated local data.
- `node dev/qa-pet-generation-recovery.cjs` checks background generation,
  navigation progress, completion reopening, unsaved reminders, local draft
  recovery, completed-action reuse, explicit discard confirmation and failed
  collection saves using isolated profiles and synthetic artwork.
- `node dev/qa-pet-dense-animation.cjs` checks all 256 generated image frames,
  correct frame order across all four sheet rows, loop wrapping, reduced motion,
  16-request creation with a failed-action retry, saved manifests and actual
  export/import. Its PNG fixtures change articulated limbs in every frame.
  It also verifies playback of older three- and four-sheet packs. All data uses
  isolated browser profiles and locally drawn artwork.
- `node dev/qa-pet-dense-release.cjs` smoke-tests the packaged Windows app
  in an isolated profile: built-in and generated 16-frame loops in the workspace
  and native desktop window, live care, real file export/import, legacy artwork
  and saved selection. It defaults to `dist/0.3.9-final/win-unpacked/Tracer.exe`;
  pass another packaged executable path as the first argument if needed.
- `node dev/qa-pet-frame-boundaries.cjs` verifies cross-cell fragment masking,
  preservation of character and prop pixels at 70/100/180% scale, transparent
  boundaries for new sheets and delayed image loading. Existing artwork is
  never rewritten: only small separated edge fragments with matching content
  across the neighboring cell boundary are hidden during playback. Ambiguous
  or connected artwork is retained. `TRACER_QA_SPRITE_ATLAS` optionally checks
  a local atlas without changing it or making an AI request.
- `node dev/qa-pet-transfer.cjs` verifies real file downloads and imports between
  isolated browser profiles, independence from the sender's assets, duplicate
  care preservation, damaged files, storage retries, legacy packs and bilingual
  responsive previews without an AI connection.
- `npm test` includes care, cooldown, streak, unlock, reminder and AI chat tests.
- `node dev/qa-pet-web.cjs` checks live interaction animations, care feedback,
  progress, persistence, AI chat UI and
  English/Chinese layouts at 360, 420, 760 and 1440 CSS pixels.
- `node dev/qa-pet-custom.cjs` checks photo upload, explicit image generation,
  regeneration, preview/adoption, error recovery, saved custom companions,
  humanoid/creature interactions, optional personality, subscription generation,
  quota errors without API fallback and bilingual layouts.
- `node dev/qa-pet.cjs` runs the Electron desktop flow against an isolated
  profile and a local mock AI service, including actual pointer dragging and
  window position persistence, compact quick care, tray behavior and reminders.
- `node dev/qa-pet-idle.cjs` checks all eight activity/type combinations with
  a controlled clock, distinct props and motion, interruption/resumption,
  completed focus rounds, reduced motion, unchanged rewards, responsive main
  layouts and the compact/expanded desktop view using a mock transport.
- `node dev/qa-pet-minimal.cjs` uses actual Electron windows to check the
  minimal resting view, pointer/keyboard icon controls, transient bubbles,
  70–180% resizing, panel collapse and size persistence across app restarts.
- `node dev/qa-pet-animation.cjs` checks all 16 behaviors with transparent
  synthetic atlases, visible frame changes, sheet cropping, partial generation
  retry and restart, saved manifests, care/focus/sleep/drag/idle routing,
  reduced motion, existing portraits and responsive layouts. Set
  `TRACER_QA_REAL_SHEET` to a local first-group PNG to validate and render its
  four behaviors without making an AI request.
- `node dev/qa-pet-soul-chat.cjs` uses delayed mock replies to check immediate
  sent/thinking bubbles, editable drafts, Enter/newline/IME handling, retries,
  language changes and stale-response cancellation. It also checks the six
  authored personalities, all 72 species/behavior combinations with sampled
  movement bounds and eye states, preferred activities, reduced motion,
  settings recovery and quiet compact views.
- The QA scripts accept `TRACER_QA_PLAYWRIGHT` for an existing Playwright
  installation and never use the user's profile or real AI credentials.
- `node dev/qa-pet-garden-chat.cjs` checks all 18 garden identities in both
  languages and both companion views, provider routing, switching companions,
  isolated histories and preservation of old replies using mocked AI transport.

## Replacing an individual action (0.3.8)

The creator can regenerate the selected action in a new companion draft or an
existing custom companion. It checkpoints `pendingReplacement` before the
request, keeps the old page until the new image passes validation, and changes
only the selected page after success. A retry uses the same page attempt and
fixed `generationIdentity`; only a rejected image or a new explicit replacement
advances the attempt. Image transport/decode failures use `animation-load-failed`
and do not advance it. The user can explicitly keep the original action instead.

Saved-companion edits carry `editingId` and a SHA-256 `editingSignature` of the
original normalized profile. Saving replaces that custom profile in place and
preserves care state. Missing or concurrently changed profiles are not silently
recreated or overwritten. After collection persistence, `markSaved()` updates
the editing base before clearing the recovery draft, so a failed clear can be
retried without losing subsequent edits. Version 2 draft records include these
fields and `retainedFrames`; version 1 recovery records are migrated on load.

`pet-edit-draft.js` reuses version 2 page URLs. For old four-frame or static
companions it copies existing pixels into editable action sheets without AI,
using the same edge masks as the player. Optional version 2
`animation.retainedFrames` / `artwork.retainedFrames` has 16 entries of 1, 4 or
16. Retained one/four-frame sheets must exactly encode their repeated frames;
four-frame actions preserve their old timing and one-frame actions stay still.
Newly generated actions always use the strict sixteen-pose validation. Replacing
one action changes only its retained count to 16. Mixed exports require 0.3.8
or newer; all-16 manifests keep the existing package format and identifiers.

The generation-recovery browser QA covers single-action interruption and
resumption, saved edits and conflict handling, failed collection/draft writes,
and export/import of edited legacy and static companions using synthetic images.
