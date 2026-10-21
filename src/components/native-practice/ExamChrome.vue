<template>
  <div class="exam-chrome">
    <header class="exam-topbar" :inert="modalOpen">
      <div class="exam-brand">IELTS Reading</div>
      <div class="exam-candidate">
        <strong>Practice candidate</strong>
        <span v-if="phase === 'details' || phase === 'instructions'" class="exam-timer prep-timer" aria-live="polite">{{ durationMinutes }} minutes left</span>
        <span v-else-if="phase === 'running' || phase === 'paused'" class="exam-timer" :class="{ 'time-warning': remainingSeconds <= 600, 'time-critical': remainingSeconds <= 300 }" role="timer" aria-label="Time remaining">
          {{ remainingLabel }}
        </span>
        <span v-else class="exam-phase-label">Review</span>
      </div>
      <div class="exam-title" :title="title">{{ title }}</div>

      <div v-if="phase === 'running' || phase === 'paused' || phase === 'submitted'" class="exam-actions">
        <details v-if="phase !== 'submitted'" ref="toolsMenu" class="exam-tools">
          <summary>Practice tools</summary>
          <div class="exam-tools-menu" @click="closeTools">
            <button v-if="phase === 'running'" type="button" @click="emit('pause')">Pause timer</button>
            <button v-else type="button" @click="emit('resume')">Resume timer</button>
            <button type="button" @click="helpOpen = true">Help</button>
            <button type="button" @click="hidden = !hidden">{{ hidden ? 'Show passage' : 'Hide passage' }}</button>
          </div>
        </details>
        <button v-if="phase !== 'submitted'" type="button" class="topbar-button topbar-submit" @click="submitOpen = true">Finish section</button>
        <button v-if="phase === 'submitted'" type="button" class="topbar-button" @click="emit('back')">Back</button>
        <button type="button" class="topbar-button" @click="openFontSize">Text Size</button>
        <button type="button" class="topbar-icon-button" aria-label="Notes" title="Notes" @click="emit('toggle-notes')"><svg aria-hidden="true" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h14a2 2 0 0 1 2 2v14"/><path d="M5 3.5a2 2 0 0 0-2 2v17a2 2 0 0 0 2 2h10"/><path d="M7 9h10M7 13h10M7 17h6"/><path d="m17 23 6-6 2 2-6 6-3 1z"/></svg></button>
      </div>
    </header>

    <main :inert="modalOpen" class="exam-content" :class="{ 'content-hidden': hidden && (phase === 'running' || phase === 'paused') }">
      <section v-if="phase === 'details'" class="entry-panel" aria-labelledby="details-heading">
        <h1 id="details-heading" class="details-heading">Confirm your details</h1>
        <div class="entry-card">
          <p class="example-label">EXAMPLE</p>
          <dl class="candidate-details">
            <div><dt>Name</dt><dd>Practice Candidate</dd></div>
            <div><dt>Date of birth</dt><dd>XX-XX-XXXX</dd></div>
            <div><dt>Candidate number</dt><dd><input class="candidate-input" value="000000" aria-label="Candidate number" /></dd></div>
          </dl>
          <button type="button" class="primary-button centered-button" @click="emit('confirm-details')">My details are correct</button>
        </div>
      </section>

      <section v-else-if="phase === 'instructions'" class="entry-panel" aria-labelledby="instructions-heading">
        <div class="instructions-content">
          <h1 id="instructions-heading">IELTS Academic Reading</h1>
          <p class="instruction-time"><strong>Time: {{ durationMinutes }} minutes</strong></p>
          <h2>INSTRUCTIONS TO CANDIDATES</h2>
          <ul class="instruction-list">
            <li>This {{ examVariant === 'suite' ? 'reading test contains 3 passages and' : 'reading practice contains' }} {{ questionCount }} questions.</li>
            <li>You have {{ durationMinutes }} minutes to complete {{ examVariant === 'suite' ? 'all three passages' : 'this single passage' }}.</li>
            <li>You can change your answers at any time before submitting.</li>
          </ul>
          <h2>INFORMATION FOR CANDIDATES</h2>
          <ul class="instruction-list">
            <li>Each question carries one mark.</li>
            <li>Your answers will be submitted automatically when the time is up.</li>
            <li>The timer changes colour with 10 minutes and 5 minutes remaining.</li>
          </ul>
          <p v-if="!ready" class="load-error" role="alert">{{ examVariant === 'suite' ? 'The test is not ready. Please return and try again.' : 'This practice could not be loaded.' }}</p>
          <div class="instruction-actions">
            <button type="button" class="secondary-button" @click="emit('back')">Back</button>
            <button type="button" class="primary-button" :disabled="!ready" @click="emit('start')">Start test</button>
          </div>
        </div>
      </section>

      <template v-else>
        <div class="slot-content" :aria-hidden="contentBlocked || undefined" :inert="contentBlocked">
          <slot />
        </div>
        <div v-if="phase === 'paused'" class="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="paused-heading">
          <div class="pause-card">
            <p class="eyebrow">Test paused</p>
            <h1 id="paused-heading">Test paused</h1>
            <p>Resume when you are ready.</p>
            <button type="button" class="primary-button" @click="emit('resume')">Resume practice</button>
          </div>
        </div>
      </template>
    </main>

    <div v-if="helpOpen" class="modal-backdrop" role="presentation" @click.self="closeHelp">
      <section ref="helpDialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-heading" @keydown.esc="closeHelp">
        <h2 id="help-heading">Help</h2>
        <ul>
          <li>Select text and use the right-click menu to highlight it.</li>
          <li>Drag an option to an answer space, or click an option and then click the space.</li>
          <li>Use the question navigation supplied below the exam content to move between questions.</li>
          <li>This {{ examVariant === 'suite' ? 'three-passage test' : 'single passage practice' }} has a {{ durationMinutes }}-minute time limit.</li>
        </ul>
        <button ref="helpCloseButton" type="button" class="secondary-button" @click="closeHelp">Close</button>
      </section>
    </div>

    <div v-if="submitOpen" class="modal-backdrop" role="presentation" @click.self="closeSubmit">
      <section ref="submitDialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="submit-heading" @keydown.esc="closeSubmit">
        <h2 id="submit-heading">Finish reading practice?</h2>
        <p v-if="unansweredCount > 0">You have {{ unansweredCount }} unanswered {{ unansweredCount === 1 ? 'question' : 'questions' }}.</p>
        <p v-else>All {{ questionCount }} questions have an answer.</p>
        <p>Are you sure you want to submit and view your review? Early finish is a practice feature.</p>
        <div class="dialog-actions">
          <button ref="submitCancelButton" type="button" class="secondary-button" @click="closeSubmit">Continue practice</button>
          <button type="button" class="primary-button" @click="confirmSubmit">Submit</button>
        </div>
      </section>
    </div>

    <div v-if="fontSizeOpen" class="modal-backdrop" role="presentation" @click.self="closeFontSize">
      <section class="dialog font-dialog" role="dialog" aria-modal="true" aria-labelledby="font-heading" @keydown.esc="closeFontSize">
        <div class="font-dialog-heading"><h2 id="font-heading">Text Size</h2><button type="button" aria-label="Close text size" @click="closeFontSize">×</button></div>
        <fieldset class="font-options">
          <legend class="visually-hidden">Choose text size</legend>
          <label v-for="option in fontOptions" :key="option.value">
            <input v-model="draftFontScale" class="visually-hidden" type="radio" name="exam-font-size" :value="option.value" />
            <span class="material-icons font-check" aria-hidden="true">check</span>
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
        <button ref="fontContinueButton" type="button" class="primary-button font-continue" @click="applyFontSize">Continue</button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PracticeFontScale } from '@/types/readingNative'

type ExamPhase = 'details' | 'instructions' | 'running' | 'paused' | 'submitted'

const props = withDefaults(defineProps<{
  phase: ExamPhase
  durationSeconds?: number
  examVariant?: 'single' | 'suite'
  remainingSeconds?: number
  questionCount?: number
  title?: string
  answeredCount?: number
  ready?: boolean
  fontScale?: PracticeFontScale
}>(), {
  durationSeconds: 1200,
  examVariant: 'single',
  remainingSeconds: 1200,
  questionCount: 0,
  title: 'Reading practice',
  answeredCount: 0,
  ready: true,
  fontScale: 'medium'
})

const emit = defineEmits<{
  'confirm-details': []
  start: []
  pause: []
  resume: []
  submit: []
  back: []
  'change-font-scale': [scale: PracticeFontScale]
  'toggle-notes': []
}>()

const helpOpen = ref(false)
const submitOpen = ref(false)
const fontSizeOpen = ref(false)
const draftFontScale = ref<PracticeFontScale>(props.fontScale)
const fontOptions: Array<{ value: PracticeFontScale; label: string }> = [
  { value: 'medium', label: 'Regular' },
  { value: 'large', label: 'Large' },
  { value: 'extra-large', label: 'Extra large' }
]
const modalOpen = computed(() => helpOpen.value || submitOpen.value || fontSizeOpen.value)
let modalTrigger: HTMLElement | null = null
watch(modalOpen, async open => {
  if (open) modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  else { await nextTick(); modalTrigger?.focus() }
})
watch(() => props.phase, phase => {
  if (phase === 'submitted') {
    submitOpen.value = false
    helpOpen.value = false
    fontSizeOpen.value = false
    hidden.value = false
  }
})
const hidden = ref(false)
const toolsMenu = ref<HTMLDetailsElement | null>(null)
function closeTools() { if (toolsMenu.value) toolsMenu.value.open = false }
function dismissTools(event: PointerEvent) {
  if (event.target instanceof Node && !toolsMenu.value?.contains(event.target)) closeTools()
}
const helpCloseButton = ref<HTMLButtonElement | null>(null)
const submitCancelButton = ref<HTMLButtonElement | null>(null)
const fontContinueButton = ref<HTMLButtonElement | null>(null)

const contentBlocked = computed(() => props.phase === 'paused' || (props.phase === 'running' && hidden.value))
const remainingLabel = computed(() => {
  const seconds = Math.max(0, Math.floor(props.remainingSeconds))
  if (seconds < 60) return `${seconds} seconds remaining`
  return `${Math.floor(seconds / 60)} minutes remaining`
})

const durationMinutes = computed(() => Math.ceil(props.durationSeconds / 60))

const unansweredCount = computed(() => Math.max(0, props.questionCount - props.answeredCount))

function confirmSubmit() {
  submitOpen.value = false
  emit('submit')
}

function closeHelp() {
  helpOpen.value = false
}

function closeSubmit() {
  submitOpen.value = false
}

function openFontSize() {
  draftFontScale.value = props.fontScale
  fontSizeOpen.value = true
}

function closeFontSize() {
  fontSizeOpen.value = false
}

function applyFontSize() {
  emit('change-font-scale', draftFontScale.value)
  closeFontSize()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (helpOpen.value) closeHelp()
  else if (submitOpen.value) closeSubmit()
  else if (fontSizeOpen.value) closeFontSize()
  else closeTools()
}

watch(helpOpen, async (open) => {
  if (open) {
    await nextTick()
    helpCloseButton.value?.focus()
  }
})

watch(submitOpen, async (open) => {
  if (open) {
    await nextTick()
    submitCancelButton.value?.focus()
  }
})

watch(fontSizeOpen, async (open) => {
  if (open) {
    await nextTick()
    fontContinueButton.value?.focus()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('pointerdown', dismissTools)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('pointerdown', dismissTools)
})
</script>

<style scoped>
:host {
  display: block;
}

.exam-chrome {
  --ink: #202b38;
  --muted: #667384;
  --line: #c7d0da;
  --blue: #1e5fa8;
  --blue-dark: #164b85;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  height: 100dvh;
  overflow: hidden;
  color: var(--ink);
  background: #fff;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.exam-topbar {
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 0 0 56px;
  min-height: 56px;
  padding: 0 28px;
  color: #202020;
  background: #fff;
  border-bottom: 1px solid #dedede;
  box-shadow: 0 2px 7px rgb(0 0 0 / 5%);
  box-sizing: border-box;
}

.exam-brand { color:#128fa3; font-size:19px; font-weight:800; white-space:nowrap; letter-spacing:-.04em; border-right:1px solid #d6d6d6; padding-right:16px; }
.exam-candidate { display:flex; flex-direction:column; justify-content:center; min-width:0; line-height:1.2; }
.exam-candidate strong { font-size:16px; font-weight:500; white-space:nowrap; }
.exam-title { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.exam-timer { color:#747474; font-variant-numeric:tabular-nums; font-size:16px; white-space:nowrap; }
.exam-timer.time-warning { color:#a45f00; }
.exam-timer.time-critical { color:#ae2b25; }
.exam-phase-label { color:#747474; font-size:13px; }
.exam-actions { display:flex; align-items:center; gap:10px; margin-left:auto; }
.topbar-button, .secondary-button, .primary-button { font: inherit; cursor: pointer; }
.topbar-button { min-height:34px; padding:5px 13px; border:1px solid #323232; border-radius:4px; color:#222; background:#fff; font-size:16px; font-weight:500; white-space:nowrap; }
.topbar-button:hover, .topbar-button:focus-visible, .topbar-icon-button:hover, .topbar-icon-button:focus-visible { background:#f3f3f0; outline:2px solid #62a5e2; outline-offset:2px; }
.topbar-icon-button { display:grid; place-items:center; width:36px; height:36px; border:0; background:#fff; color:#242424; cursor:pointer; }
.topbar-icon-button svg { width:27px; height:27px; }
.exam-tools { position:relative; font-size:12px; }
.exam-tools summary { cursor:pointer; color:#555; padding:8px; list-style:none; }
.exam-tools summary::-webkit-details-marker { display:none; }
.exam-tools summary:hover, .exam-tools summary:focus-visible { color:#111; text-decoration:underline; outline:2px solid #62a5e2; outline-offset:2px; }
.exam-tools-menu { position:absolute; right:0; top:calc(100% + 7px); display:grid; gap:2px; width:154px; padding:5px; background:#fff; border:1px solid #cfcfcf; box-shadow:0 6px 18px rgb(0 0 0 / 14%); z-index:8; }
.exam-tools-menu button { border:0; background:#fff; color:#222; text-align:left; padding:8px; cursor:pointer; }
.exam-tools-menu button:hover, .exam-tools-menu button:focus-visible { background:#edf5fb; }

.exam-content { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.content-hidden > .slot-content { visibility: hidden; }
.slot-content { height: 100%; min-height: 0; }

.entry-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; overflow: auto; padding: 38px 20px; box-sizing: border-box; }
.details-heading { margin-bottom: 12px; color: #26384f; font-size: 25px; text-align: center; }
.entry-card { width: 72%; max-width: 720px; padding: 25px 45px 29px; border: 1px solid #fff; background: rgb(255 255 255 / 8%); box-sizing: border-box; }
.example-label { margin: 0 0 18px; color: #b33636; font-size: 15px; font-weight: 700; text-align: center; }
.eyebrow { margin: 0 0 10px; color: var(--blue); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
h1, h2 { margin: 0 0 15px; font-weight: 700; }
h1 { font-size: 26px; }
h2 { font-size: 21px; }
.entry-copy, .instruction-lede, .pause-card p, .dialog p { color: var(--muted); line-height: 1.55; }
.candidate-details { margin: 0 auto 24px; max-width: 520px; }
.candidate-details div { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 9px 0; }
.candidate-details dt { color: #26384f; font-weight: 700; }
.candidate-details dd { margin: 0; color: #26384f; font-weight: 400; }
.candidate-input { width: 100%; max-width: 180px; padding: 4px 6px; border: 1px solid #8797aa; border-radius: 2px; box-sizing: border-box; color: #26384f; background: #fff; }
.centered-button { display: block; margin: 0 auto; }
.instructions-content { width: 100%; height: 100%; padding: 50px 50px 40px; overflow: auto; box-sizing: border-box; }
.instructions-content h1 { margin-bottom: 28px; color: #26384f; font-size: 27px; }
.instructions-content h2 { margin: 29px 0 18px; color: #26384f; font-size: 16px; }
.instruction-time { margin: 0; color: #26384f; }
.instruction-list { margin: 0 0 28px; padding-left: 21px; color: #26384f; line-height: 1.7; }
.load-error { color: #9e2b2b; font-weight: 700; }
.instruction-actions { display: flex; justify-content: center; gap: 10px; margin-top: 35px; }
.primary-button, .secondary-button { padding: 9px 16px; border-radius: 2px; font-size: 13px; font-weight: 700; }
.primary-button { border: 1px solid var(--blue-dark); color: #fff; background: var(--blue); }
.primary-button:hover, .primary-button:focus-visible { background: var(--blue-dark); outline: 2px solid #9cc4e8; outline-offset: 1px; }
.primary-button:disabled { cursor: not-allowed; opacity: .55; }
.secondary-button { border: 1px solid #9aa8b6; color: var(--ink); background: #f5f7f9; }
.secondary-button:hover, .secondary-button:focus-visible { background: #e8edf2; outline: 2px solid #9cc4e8; outline-offset: 1px; }

.pause-overlay { position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; padding: 20px; background: #f3f3f0; box-sizing: border-box; }
.pause-card { width: min(100%, 420px); padding: 32px; background: #fff; box-shadow: 0 4px 14px rgb(0 0 0 / 24%); text-align: center; }
.pause-card .eyebrow { margin-bottom: 12px; }

.modal-backdrop { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgb(18 28 39 / 55%); box-sizing: border-box; }
.dialog { width: min(100%, 460px); padding: 26px 30px; border: 1px solid #b7c2cd; background: #fff; box-shadow: 0 5px 18px rgb(0 0 0 / 25%); box-sizing: border-box; }
.dialog ul { margin: 0 0 24px; padding-left: 20px; color: var(--muted); line-height: 1.65; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
.font-dialog { width:min(100%, 426px); padding:0 0 20px; border-radius:4px; }
.font-dialog-heading { display:flex; align-items:center; justify-content:space-between; height:46px; box-sizing:border-box; padding:12px 20px; border-bottom:1px solid #dedede; }
.font-dialog-heading h2 { margin:0; font-size:16px; line-height:20px; color:#111; }
.font-dialog-heading button { border:0; background:transparent; color:#666; font-size:22px; cursor:pointer; }
.font-options { margin:10px 28px 30px; padding:0; border:0; }
.font-options label { display:flex; align-items:center; gap:12px; min-height:53px; border-bottom:1px solid #c9c9c9; cursor:pointer; font-size:15px; }
.font-check { width:18px; font-size:21px; color:#555; visibility:hidden; }
.font-options input:checked + .font-check { visibility:visible; }
.font-options input:focus-visible + .font-check { visibility:visible; outline:2px solid #428fda; }
.font-continue { display:block; box-sizing:border-box; height:35px; padding:5px 16px; border-radius:4px; font-size:16px; font-weight:400; margin:0 auto; min-width:145px; background:#343434; border-color:#343434; }
.visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }

@media (max-width: 720px) {
  .exam-topbar { gap:8px; padding:0 10px; }
  .exam-brand { display: none; }
  .exam-candidate strong { font-size:12px; }
  .exam-timer { font-size:11px; }
  .exam-actions { gap:4px; }
  .exam-tools summary { padding:4px; font-size:0; }
  .exam-tools summary::before { content:'⋯'; font-size:23px; }
  .topbar-button { padding:5px 7px; font-size:11px; }
  .topbar-icon-button { width:28px; }
  .topbar-icon-button svg { width:21px; height:21px; }
  .entry-card { width: 92%; padding: 24px 20px; }
  .instructions-content { padding: 35px 22px 30px; }
}
</style>
