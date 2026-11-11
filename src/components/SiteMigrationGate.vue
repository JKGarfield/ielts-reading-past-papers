<template>
  <dialog
    ref="dialog"
    class="site-migration-dialog"
    aria-labelledby="site-migration-title"
    aria-describedby="site-migration-description"
    aria-modal="true"
    tabindex="-1"
    closedby="none"
    @cancel.prevent
    @keydown.esc.prevent
    @submit.prevent
  >
    <div class="migration-eyebrow">
      <span class="migration-symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 18 18 6M7 6h11v11" /></svg>
      </span>
      <span>站点迁移通知</span>
    </div>

    <h1 id="site-migration-title">练习站已迁移</h1>
    <p id="site-migration-description">
      由于云资源有限，当前练习站已迁移至<strong>JK IELTS练习站</strong>，听/阅/写各类资源一网打尽。
    </p>

    <a class="migration-destination" :href="REPLACEMENT_SITE_URL">
      <span>{{ REPLACEMENT_SITE_URL }}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M7 6h11v11" /></svg>
    </a>
    <a class="migration-primary" :href="REPLACEMENT_SITE_URL">
      <span>前往新站点</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    </a>
  </dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { REPLACEMENT_SITE_URL } from '@/utils/siteMigration'

const dialog = ref<HTMLDialogElement>()
let originalOverflow = ''

onMounted(() => {
  originalOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  // Native modal behavior confines focus and blocks the entire background,
  // including any elements teleported outside the application root.
  dialog.value?.showModal()
  dialog.value?.focus()
})

onBeforeUnmount(() => {
  dialog.value?.close()
  document.documentElement.style.overflow = originalOverflow
})
</script>

<style scoped>
.site-migration-dialog {
  box-sizing: border-box;
  width: 520px;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 36px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #dce2f1);
  border-radius: 22px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #141f3d);
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif);
  box-shadow: 0 28px 80px -24px rgba(9, 17, 45, .32);
  outline: none;
}
.site-migration-dialog::backdrop {
  background: rgba(20, 28, 40, .45);
  backdrop-filter: blur(5px);
}
.migration-eyebrow { display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 600; color: var(--primary-color, #1b2a5e); letter-spacing: .04em; }
.migration-symbol { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--primary-border-soft, #dce2f1); border-radius: 12px; background: var(--primary-soft, #edf0f9); }
svg { width: 20px; height: 20px; flex-shrink: 0; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.migration-symbol svg { width: 23px; height: 23px; }
h1 { margin: 24px 0 16px; color: inherit; font-size: 28px; font-weight: 650; line-height: 1.35; letter-spacing: -.035em; }
p { margin: 0; color: var(--text-secondary, #464f73); font-size: 14px; line-height: 1.95; }
strong { color: var(--text-primary, #141f3d); font-weight: 600; }
a { text-decoration: none; -webkit-tap-highlight-color: transparent; }
.migration-destination { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 26px; padding: 15px 16px; border: 1px solid var(--border-color, #dce2f1); border-radius: 10px; background: var(--control-muted-bg, #f4f6fc); color: var(--primary-color, #1b2a5e); font-size: 14px; line-height: 1.5; font-weight: 500; transition: border-color 160ms ease, background-color 160ms ease; }
.migration-destination span { overflow-wrap: anywhere; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--primary-border, #c4cde6); }
.migration-destination svg { width: 17px; height: 17px; }
.migration-primary { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 18px; min-height: 52px; padding: 13px 18px; border: 1px solid transparent; border-radius: 10px; background: var(--primary-color, #1b2a5e); color: var(--on-primary, #fff); font-size: 14px; line-height: 1.6; font-weight: 600; transition: background-color 160ms ease; }
.migration-primary:active { background: var(--primary-hover, #283c7c); }
a:focus-visible { outline: 3px solid var(--accent-color, #c9952a); outline-offset: 4px; }
@media (hover: hover) and (pointer: fine) {
  .migration-destination:hover { border-color: var(--primary-border, #c4cde6); background: var(--surface-active, #edf0f9); }
  .migration-primary:hover { background: var(--primary-hover, #283c7c); color: var(--on-primary, #fff); }
}
@media (max-width: 540px) {
  .site-migration-dialog { padding: 28px 24px; border-radius: 18px; }
  h1 { font-size: 26px; margin-top: 22px; }
  .migration-destination { gap: 10px; padding: 14px; font-size: 12px; }
}
</style>
