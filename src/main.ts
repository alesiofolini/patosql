import './styles.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('No se encontró #app');

new App(root);
