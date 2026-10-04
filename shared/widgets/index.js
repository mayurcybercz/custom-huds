// Registry of reusable widgets. Skins reference these by name via data-widget="…",
// and can spread this object to add or override widgets of their own.
import { mount as todo } from './todo.js';
import { mount as projects } from './projects.js';
import { mount as research } from './research.js';
import { mount as terminal } from './terminal.js';
import { mount as pet } from './pet.js';
import { mount as media } from './media.js';
import { mount as sys } from './sys.js';
import { tech, anime } from './feeds.js';

export const widgets = { todo, projects, research, terminal, pet, media, sys, tech, anime };
