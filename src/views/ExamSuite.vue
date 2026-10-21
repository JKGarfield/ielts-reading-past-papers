<template>
  <div v-if="loadError" class="suite-error" role="alert">
    <h1>暂时无法打开这套模考</h1><p>{{ loadError }}</p>
    <button type="button" @click="backToSetup">返回组卷</button>
    <button type="button" @click="loadSuite">重试</button>
  </div>
  <div v-else-if="!prepared" class="suite-error" role="status">正在检查三篇文章与 40 道题目…</div>
  <ExamChrome v-else :phase="clock.phase" :remaining-seconds="clock.remainingSeconds" :duration-seconds="3600"
    exam-variant="suite" title="Academic Reading · Full test" :question-count="40" :answered-count="answeredCount"
    :font-scale="fontScale"
    :ready="!!prepared" @confirm-details="clock.goToInstructions" @start="clock.start" @pause="clock.pause"
    @resume="clock.resume" @submit="submitSuite" @back="backToSetup" @change-font-scale="setFontScale" @toggle-notes="toggleNotes">
    <div class="suite-body">
      <div v-if="passageError" class="suite-notice" role="alert">{{ passageError }} <button type="button" @click="retryPassages">Retry loading</button></div>
      <div v-if="saveError" class="suite-notice" role="alert">成绩尚未保存到本地记录，请保留此页面。<button type="button" @click="retrySave">重新保存</button></div>
      <section v-if="completed" class="suite-result" aria-label="Full test result">
        <div><strong>{{ completed.correct }} / 40</strong><span>整套正确数 · {{ completed.accuracy }}% · 用时 {{ formatDuration(completed.durationSeconds) }}</span></div>
        <div class="part-results">
          <button v-for="(part, index) in completed.passages" :key="part.id" type="button" @click="jumpToPart(index)">Part {{ index + 1 }} · {{ part.result.scoreInfo.correct }}/{{ part.result.scoreInfo.totalQuestions }}</button>
        </div>
        <button type="button" @click="backToSetup">返回模考记录</button>
      </section>
      <div class="suite-passages">
        <div v-for="(exam, index) in prepared.passages" :key="`${attemptId}:${exam.examId}`" v-show="activePart === index" class="suite-passage" :aria-hidden="activePart !== index || undefined">
          <PracticeMode :ref="instance => setPassageRef(index, instance)" embedded :embedded-exam-id="exam.examId"
            :embedded-attempt-id="attemptId" :part-number="index + 1" :active="activePart === index"
            :exam-pane-width="paneWidth" :exam-font-scale="fontScale" @update:exam-pane-width="setPaneWidth"
            @suite-state="state => onPassageState(index, state)" />
        </div>
        <div v-if="!completed" class="suite-arrows"><button type="button" aria-label="Previous question" :disabled="activeNumber <= 1" @click="goToQuestion(activeNumber - 1)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4m0 0 7-7m-7 7 7 7"/></svg></button><button type="button" aria-label="Next question" :disabled="activeNumber >= 40" @click="goToQuestion(activeNumber + 1)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16m0 0-7-7m7 7-7 7"/></svg></button></div>
      </div>
      <footer class="suite-navigation" aria-label="Full test question navigation">

        <div ref="questionStrip" class="suite-question-strip">
          <div v-for="(exam, index) in prepared.passages" :key="exam.examId" class="suite-nav-part" :class="{ active: activePart === index }">
            <button type="button" class="part-label" :class="{ active: activePart === index }" :aria-expanded="activePart === index" @click="jumpToPart(index)">Part {{ index + 1 }}</button>
            <button v-if="activePart !== index" type="button" class="part-count" :aria-label="`Open Part ${index + 1}`" @click="jumpToPart(index)">{{ answeredCountForPart(index) }} of {{ exam.questionItems.length }}</button>
            <button v-for="item in activePart === index ? exam.questionItems : []" :key="item.questionId" type="button" class="suite-question"
              :data-display-number="item.displayNumber" :class="questionClasses(index, item.questionId, Number(item.displayNumber))"
              :aria-label="`Question ${item.displayNumber}`" :aria-current="activeNumber === Number(item.displayNumber) ? 'step' : undefined"
              :title="questionTitle(index, item.questionId)" @click="goToQuestion(Number(item.displayNumber))">{{ item.displayNumber }}</button>
          </div>
        </div>
      </footer>
    </div>
  </ExamChrome>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, proxyRefs, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ExamChrome from '@/components/native-practice/ExamChrome.vue'
import PracticeMode from '@/views/PracticeMode.vue'
import { useExamClock } from '@/composables/useExamClock'
import { useExamSuiteAttempt } from '@/composables/useExamSuiteAttempt'
import { prepareSuite, buildSuiteAttempt } from '@/utils/examSuite'
import type { SuitePassageHandle, SuitePassageState } from '@/types/examPassage'
import type { ExamSuiteAttempt, PreparedExamSuite, SuitePassages, ExamSuitePassageResult } from '@/types/examSuite'
import type { PracticeFontScale } from '@/types/readingNative'

const route = useRoute()
const router = useRouter()
const ids = String(route.query.passages || '').split(',').filter(Boolean)
const attemptId = typeof route.query.attemptId === 'string' && route.query.attemptId ? route.query.attemptId : crypto.randomUUID()
if (!route.query.attemptId) void router.replace({ path: '/exam-suite', query: { ...route.query, attemptId } })
const prepared = shallowRef<PreparedExamSuite | null>(null)
const loadError = ref('')
const saveError = ref(false)
const completed = shallowRef<ExamSuiteAttempt | null>(null)
const attempts = useExamSuiteAttempt()
const passageRefs: Array<SuitePassageHandle | null> = [null, null, null]
const passageStates = ref<Array<SuitePassageState | null>>([null, null, null])
const viewKey = `ielts_suite_view::${attemptId}`
const activeNumber = ref(1)
const lastNumbers = ref<[number, number, number]>([1, 14, 27])
const paneWidth = ref(50)
const fontScale = ref<PracticeFontScale>('medium')
try {
  const saved = JSON.parse(sessionStorage.getItem(viewKey) || 'null')
  if (saved?.ids?.join(',') === ids.join(',')) {
    if (Number.isInteger(saved.number) && saved.number >= 1 && saved.number <= 40) activeNumber.value = saved.number
    if (Array.isArray(saved.lastNumbers) && saved.lastNumbers.length === 3 && saved.lastNumbers.every((number: number, index: number) => Number.isInteger(number) && number >= [1, 14, 27][index] && number <= [13, 26, 40][index])) lastNumbers.value = saved.lastNumbers
    if (typeof saved.paneWidth === 'number' && saved.paneWidth >= 25 && saved.paneWidth <= 75) paneWidth.value = saved.paneWidth
    if (['medium', 'large', 'extra-large'].includes(saved.fontScale)) fontScale.value = saved.fontScale
  }
} catch { /* A browser can disable storage; the current test remains usable. */ }
const activePart = computed(() => activeNumber.value <= 13 ? 0 : activeNumber.value <= 26 ? 1 : 2)
const allReady = computed(() => passageStates.value.every(state => state?.ready))
const clock = proxyRefs(useExamClock({
  key: ref(`ielts_suite_clock::${attemptId}::${ids.join(',')}`),
  durationSeconds: 3600,
  enabled: allReady,
  onExpire: () => submitSuite()
}))
let finishing = false
let restored = false
const questionStrip = ref<HTMLElement | null>(null)
const passageError = computed(() => passageStates.value.map((state, index) => state?.error ? `Part ${index + 1}: ${state.error}` : '').filter(Boolean).join(' · '))
const answeredCount = computed(() => passageStates.value.reduce((total, state) => total + Object.values(state?.answerMap || {}).filter(hasAnswer).length, 0))
const activeItem = computed(() => prepared.value?.passages[activePart.value].questionItems.find(item => Number(item.displayNumber) === activeNumber.value))
const activeMarked = computed(() => !!activeItem.value && !!passageStates.value[activePart.value]?.markedQuestions.includes(activeItem.value.questionId))

function hasAnswer(value: string | string[]) { return Array.isArray(value) ? value.some(item => item.trim()) : !!String(value).trim() }
function answeredCountForPart(index: number) { return Object.values(passageStates.value[index]?.answerMap || {}).filter(hasAnswer).length }
function partForQuestion(number: number) { return number <= 13 ? 0 : number <= 26 ? 1 : 2 }
function setPaneWidth(width: number) { paneWidth.value = Math.min(75, Math.max(25, width)) }
function setFontScale(scale: PracticeFontScale) { fontScale.value = scale }
function toggleNotes() { passageRefs[activePart.value]?.toggleNotes() }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
function setPassageRef(index: number, instance: unknown) { passageRefs[index] = instance as SuitePassageHandle | null }
function onPassageState(index: number, state: SuitePassageState) {
  const previous = passageStates.value[index]
  passageStates.value[index] = state
  if (index === activePart.value && previous?.ready && state.ready && previous.activeQuestionId !== state.activeQuestionId) {
    const item = state.questionItems.find(entry => entry.questionId === state.activeQuestionId)
    if (item) activeNumber.value = Number(item.displayNumber)
  }
}
function questionClasses(index: number, id: string, number: number) {
  const answer = completed.value?.passages[index].result.answerComparison[id]
  return { current: activeNumber.value === number, answered: hasAnswer(passageStates.value[index]?.answerMap[id] || ''), marked: passageStates.value[index]?.markedQuestions.includes(id), correct: answer?.isCorrect === true, incorrect: answer?.isCorrect === false }
}
function questionTitle(index: number, id: string) {
  const state = passageStates.value[index]
  return `${hasAnswer(state?.answerMap[id] || '') ? 'Answered' : 'Not answered'}${state?.markedQuestions.includes(id) ? ' · Review' : ''}`
}
async function goToQuestion(number: number) {
  if (!prepared.value || number < 1 || number > 40) return
  activeNumber.value = number
  await nextTick()
  const item = activeItem.value
  if (item) await passageRefs[activePart.value]?.navigateToQuestion(item.questionId, item.anchorId)
  questionStrip.value?.querySelector(`[data-display-number="${number}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
function jumpToPart(index: number) { void goToQuestion(lastNumbers.value[index] || [1, 14, 27][index]) }
function toggleReview() { if (activeItem.value) passageRefs[activePart.value]?.toggleReview(activeItem.value.questionId) }
function backToSetup() { void router.push('/exam-setup') }
async function retryPassages() { await Promise.all(passageRefs.map(part => part?.reload())) }

async function loadSuite() {
  loadError.value = ''
  try {
    const suite = await prepareSuite(ids)
    const prior = attempts.get(attemptId)
    if (prior && prior.passages.map(part => part.id).join(',') !== ids.join(',')) throw new Error('这条模考记录的篇目与链接不一致，请从记录列表重新打开。')
    prepared.value = suite
    if (prior) {
      completed.value = prior
      clock.finish()
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '套题加载失败，请重新选择三篇文章。'
  }
}
function retrySave() {
  if (!completed.value) return
  saveError.value = !attempts.save(completed.value)
  if (!saveError.value) passageRefs.forEach(part => part?.clearSuiteDraft())
}
function submitSuite() {
  if (finishing || completed.value || !allReady.value) return
  finishing = true
  try {
    const snapshots = passageRefs.map(part => part?.submitForSuite())
    if (snapshots.some(part => !part)) throw new Error('三篇文章尚未加载完成，请重试。')
    completed.value = buildSuiteAttempt({ attemptId, passages: snapshots as SuitePassages<ExamSuitePassageResult>, durationSeconds: clock.elapsedSeconds })
    retrySave()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '交卷失败，请重试。'
  } finally {
    clock.finish()
    finishing = false
  }
}
watch(allReady, async ready => {
  if (!ready || restored) return
  restored = true
  if (completed.value) completed.value.passages.forEach((part, index) => passageRefs[index]?.restoreSuiteResult(part))
  else if (clock.phase === 'submitted') submitSuite()
  await nextTick()
  // Restore navigation without making three independent timers or losing passage scroll positions.
  const item = activeItem.value
  if (item && activeNumber.value !== [1, 14, 27][activePart.value]) await goToQuestion(activeNumber.value)
})
watch(activeNumber, number => { lastNumbers.value[partForQuestion(number)] = number })
watch([activeNumber, lastNumbers, paneWidth, fontScale], () => {
  try { sessionStorage.setItem(viewKey, JSON.stringify({ ids, number: activeNumber.value, lastNumbers: lastNumbers.value, paneWidth: paneWidth.value, fontScale: fontScale.value })) } catch { /* In-memory settings remain available. */ }
}, { deep: true })
onMounted(loadSuite)
</script>

<style scoped>
.suite-body { height:100%; min-height:0; display:flex; flex-direction:column; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#202020; background:#fff; }
.suite-passages { flex:1; min-height:0; position:relative; }
.suite-passage { height:100%; min-height:0; }
.suite-navigation { flex:none; display:flex; align-items:center; gap:16px; padding:5px 40px; min-height:74px; box-sizing:border-box; background:#fff; border-top:0; }
.suite-question-strip { display:flex; flex:1; align-items:center; justify-content:space-between; min-width:0; overflow-x:auto; gap:18px; padding:16px 2px 0; scrollbar-width:thin; }
.suite-nav-part { display:flex; align-items:center; flex-shrink:0; gap:4px; white-space:nowrap; }
.suite-nav-part.active { flex:0 1 auto; }
.part-label { font:400 16px "Helvetica Neue",Helvetica,Arial,sans-serif; border:0; background:transparent; padding:4px 6px; white-space:nowrap; cursor:pointer; color:#333; }
.part-label.active { position:relative; min-width:100px; font-weight:400; color:#111; }
.part-label.active::before { content:""; position:absolute; top:-15px; left:0; right:4px; height:3px; background:#eee; }
.part-count { padding:4px 6px; border:0; background:transparent; font:400 16px "Helvetica Neue",Helvetica,Arial,sans-serif; color:#202020; cursor:pointer; }
.suite-question { width:28px; height:31px; padding:0; border:0; border-radius:0; background:#fff; color:#202020; font:400 16px "Helvetica Neue",Helvetica,Arial,sans-serif; position:relative; cursor:pointer; }
.suite-question.current { background:#fff; color:#111; outline:2px solid #57a7ec; outline-offset:-2px; }
.suite-question::before { content:""; position:absolute; top:-14px; left:0; right:0; height:3px; background:#eee; }
.suite-question.answered::before { background:#509d00; }
.suite-question.marked::after { content:''; position:absolute; right:1px; bottom:0; width:5px; height:5px; border-radius:50%; background:#bf8c2d; }
.suite-question.correct { background:#dceede; color:#174323; }.suite-question.incorrect { background:#f8e0e0; color:#6f2424; }
.suite-review { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; min-width:44px; padding:2px; border:0; background:#fff; color:#555; font:11px Arial,sans-serif; cursor:pointer; }
.suite-review svg { width:20px; height:20px; }
.suite-review.marked { color:#9a680e; }
.suite-review:disabled { opacity:.5; cursor:default; }
.suite-arrows { position:absolute; z-index:10; right:40px; bottom:40px; display:flex; gap:5px; }
.suite-arrows button { width:50px; height:50px; border:0; border-radius:3px; background:#383838; font-size:29px; line-height:1; color:#fff; cursor:pointer; }
.suite-arrows button svg { width:32px; height:32px; vertical-align:middle; }
.suite-arrows button:disabled { background:#e6e6e6; color:#fff; cursor:default; }
.suite-arrows button:not(:disabled):hover, .suite-arrows button:not(:disabled):focus-visible { background:#202020; outline:2px solid #5aa4e5; outline-offset:2px; }
.suite-result { display:flex; align-items:center; flex-wrap:wrap; gap:18px; padding:10px 28px; background:#f4f7fb; border-bottom:1px solid #bac7d6; }.suite-result strong { font-size:23px; margin-right:12px; }.suite-result span { font-size:13px; }.part-results { display:flex; gap:8px; margin-left:auto; }
.suite-result button,.suite-notice button,.suite-error button { padding:7px 12px; border:1px solid #b3bfcd; border-radius:3px; background:#fff; color:#222; cursor:pointer; }
.suite-notice { padding:8px 28px; background:#fff1cf; font-size:13px; }.suite-error { padding:60px; max-width:900px; margin:auto; font-family:Arial,sans-serif; }.suite-error button { margin-right:12px; }
button:focus-visible { outline:2px solid #397fbc; outline-offset:2px; }
@media(max-width:900px) { .suite-navigation { padding:6px 12px; gap:6px; }.suite-question-strip { justify-content:flex-start; }.suite-arrows { right:22px; bottom:18px; }.suite-result { padding:8px; gap:8px; }.suite-result span { display:block; }.part-results { margin-left:0; }.suite-nav-part { gap:3px; } }
</style>
