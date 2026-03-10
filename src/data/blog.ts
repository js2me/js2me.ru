export interface InternalPost {
  type: 'internal';
  title: string;
  slug: string;
  description: string;
}

export interface ExternalPost {
  type: 'external';
  title: string;
  url: string;
  description: string;
}

export type BlogPost = InternalPost | ExternalPost;

const internalPosts: InternalPost[] = [
  {
    type: 'internal',
    title: 'Первый пост',
    slug: '/blog/hello',
    description: 'Приветствие и начало ведения блога на Astro.',
  },
];

const devToArticles: ExternalPost[] = [
  { type: 'external', title: 'Simple reactivity in React with MobX', url: 'https://dev.to/js2me/simple-reactivity-in-react-with-mobx-17ga', description: 'Удобная реактивность в React с MobX.' },
  { type: 'external', title: 'Diving into MobX', url: 'https://dev.to/js2me/diving-into-mobx-35h2', description: 'Погружение в MobX и его философию.' },
  { type: 'external', title: 'Why Swagger schemes are needed in frontend development?', url: 'https://dev.to/js2me/why-swagger-schemes-are-needed-in-frontend-development-2cb4', description: 'Зачем фронтенду схемы Swagger и генерация API.' },
  { type: 'external', title: 'So what is Effector ☄️?', url: 'https://dev.to/js2me/so-what-is-effector--3fl1', description: 'Знакомство с Effector — stores, effects, events.' },
  { type: 'external', title: 'Own state manager in 80 lines', url: 'https://dev.to/js2me/own-state-manager-in-80-lines-4mbi', description: 'Свой state manager на базе Reffect.' },
  { type: 'external', title: 'Make your own custom theme for VS Code', url: 'https://dev.to/js2me/make-your-own-custom-theme-for-vs-code-me7', description: 'Кастомные темы и CSS в VS Code.' },
];

/** Все посты блога (внутренние сначала, затем внешние). */
export const allBlogPosts: BlogPost[] = [...internalPosts, ...devToArticles];

/** Последние N постов. */
export function getLatestPosts(n: number): BlogPost[] {
  return allBlogPosts.slice(0, n);
}
