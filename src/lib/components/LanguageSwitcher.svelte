<script lang="ts">
  import { currentLanguage, setLanguage, getSupportedLanguages } from '$lib/i18n';

  /**
   * 获取支持的语言配置
   */
  const supportedLanguages = getSupportedLanguages();

  /**
   * 处理语言切换
   */
  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target && target.value in supportedLanguages) {
      setLanguage(target.value as keyof typeof supportedLanguages);
    }
  }
</script>

<div class="language-switcher">
  <select
    bind:value={$currentLanguage}
    on:change={handleLanguageChange}
    class="language-select"
    aria-label="选择语言 / Select Language"
  >
    {#each Object.entries(supportedLanguages) as [code, config]}
      <option value={code}>{config.name}</option>
    {/each}
  </select>
</div>

<style>
  .language-switcher {
    position: relative;
    z-index: 10;
  }

  .language-select {
    padding: 0.5rem 1rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    color: #374151;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 100px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
  }

  .language-select:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .language-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: rgba(255, 255, 255, 1);
  }

  .language-select option {
    background: white;
    color: #374151;
    padding: 0.5rem;
  }

  /* 深色模式适配 */
  @media (prefers-color-scheme: dark) {
    .language-select {
      background: rgba(51, 65, 85, 0.9);
      color: #f1f5f9;
      border-color: rgba(255, 255, 255, 0.2);
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%9ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    }

    .language-select:hover {
      background: rgba(51, 65, 85, 1);
      border-color: rgba(99, 102, 241, 0.5);
    }

    .language-select:focus {
      background: rgba(51, 65, 85, 1);
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
    }

    .language-select option {
      background: #334155;
      color: #f1f5f9;
    }
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .language-select {
      font-size: 0.85rem;
      padding: 0.4rem 0.8rem;
      padding-right: 2.2rem;
      min-width: 85px;
    }
  }
</style>