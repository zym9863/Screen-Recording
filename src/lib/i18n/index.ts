/**
 * 国际化系统
 * 提供语言管理、翻译文本访问和响应式更新功能
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supportedLanguages, type SupportedLanguage, type Translations } from './translations';

// 默认语言
const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

// 语言存储key
const LANGUAGE_STORAGE_KEY = 'screen-recorder-language';

/**
 * 从本地存储加载保存的语言设置
 */
function loadSavedLanguage(): SupportedLanguage {
  if (!browser) return DEFAULT_LANGUAGE;

  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && saved in supportedLanguages) {
      return saved as SupportedLanguage;
    }
  } catch (error) {
    console.warn('Failed to load saved language:', error);
  }

  return DEFAULT_LANGUAGE;
}

/**
 * 保存语言设置到本地存储
 */
function saveLanguage(language: SupportedLanguage): void {
  if (!browser) return;

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to save language:', error);
  }
}

/**
 * 当前语言 store
 */
export const currentLanguage = writable<SupportedLanguage>(loadSavedLanguage());

/**
 * 当前翻译文本 store (响应式)
 */
export const translations = derived(
  currentLanguage,
  ($currentLanguage) => supportedLanguages[$currentLanguage].translations
);

/**
 * 切换语言
 * @param language 目标语言
 */
export function setLanguage(language: SupportedLanguage): void {
  if (language in supportedLanguages) {
    currentLanguage.set(language);
    saveLanguage(language);
  }
}

/**
 * 获取当前语言
 * @returns 当前语言标识
 */
export function getCurrentLanguage(): SupportedLanguage {
  return get(currentLanguage);
}

/**
 * 获取支持的语言列表
 * @returns 支持的语言配置
 */
export function getSupportedLanguages() {
  return supportedLanguages;
}

/**
 * 翻译辅助函数类型 - 简化版本，避免复杂的递归类型
 */
type TranslationPath = string;

/**
 * 根据键路径获取翻译文本
 * @param keyPath 翻译键的点分隔路径
 * @param currentTranslations 当前翻译对象
 * @returns 翻译文本
 */
function getNestedTranslation(keyPath: string, currentTranslations: Translations): string {
  const keys = keyPath.split('.');
  let result: any = currentTranslations;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      console.warn(`Translation key not found: ${keyPath}`);
      return keyPath; // 返回原始key作为fallback
    }
  }

  return typeof result === 'string' ? result : keyPath;
}

/**
 * 创建翻译函数 (响应式)
 * @returns 翻译函数
 */
export function createTranslationFunction() {
  return derived(translations, ($translations) => {
    return function t(keyPath: string, params?: Record<string, any>): string {
      let text = getNestedTranslation(keyPath, $translations);

      // 简单的参数替换
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
      }

      return text;
    };
  });
}

/**
 * 全局翻译函数 store
 */
export const t = createTranslationFunction();

/**
 * 同步版本的翻译函数 (用于非响应式场景)
 * @param keyPath 翻译键路径
 * @param params 替换参数
 * @returns 翻译文本
 */
export function translate(keyPath: string, params?: Record<string, any>): string {
  const currentTranslations = get(translations);
  let text = getNestedTranslation(keyPath, currentTranslations);

  // 简单的参数替换
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }

  return text;
}

/**
 * 格式化消息的辅助函数
 * @param messageKey 消息键
 * @param details 详细信息
 * @returns 格式化后的消息
 */
export function formatMessage(messageKey: string, details?: string): string {
  const baseMessage = translate(messageKey);
  return details ? `${baseMessage}: ${details}` : baseMessage;
}

// 初始化时检查浏览器语言偏好
if (browser) {
  const browserLanguage = navigator.language;
  const supportedLangs = Object.keys(supportedLanguages);

  // 如果用户还没有保存过语言偏好，尝试使用浏览器语言
  if (!localStorage.getItem(LANGUAGE_STORAGE_KEY)) {
    // 精确匹配
    if (supportedLangs.includes(browserLanguage)) {
      setLanguage(browserLanguage as SupportedLanguage);
    } else {
      // 语言代码匹配（如 en-US -> en）
      const langCode = browserLanguage.split('-')[0];
      const matchedLang = supportedLangs.find(lang => lang.startsWith(langCode));
      if (matchedLang) {
        setLanguage(matchedLang as SupportedLanguage);
      }
    }
  }
}