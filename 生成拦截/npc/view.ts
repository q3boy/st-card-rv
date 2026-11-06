import { createApp } from 'vue';
import styles from 'virtual:rv-npc-styles';
import type { DvsPreNarrativeContext } from '../types';
import NpcGenerate from './NpcGenerate.vue';

function host(container: HTMLElement) {
  const document = container.ownerDocument;
  const element = document.createElement('div');
  element.className = 'rv-npc';
  const shadow = element.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const root = document.createElement('div');
  shadow.append(style, root);
  container.append(element);
  return { element, root };
}

export function mountNpcView(container: HTMLElement, context: DvsPreNarrativeContext) {
  const view = host(container);
  const app = createApp(NpcGenerate, { context, substitute: (text: string) => globalThis.substitudeMacros(text) });
  app.mount(view.root);
  return () => {
    app.unmount();
    view.element.remove();
  };
}
