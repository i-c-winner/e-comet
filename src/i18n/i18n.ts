import i18n from 'i18next';
import { en } from './locales/en/en.ts';
import { ru } from './locales/ru/ru.ts';
import { initReactI18next } from 'react-i18next';

const resources = {
    en,
    ru,
};

i18n.use(initReactI18next).init({
    resources,
    lng: 'ru',
});
export { i18n };
