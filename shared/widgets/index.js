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
import { mount as pomodoro } from './pomodoro.js';
import { mount as water } from './water.js';
import { mount as meals } from './meals.js';
import { mount as schedule } from './schedule.js';
import { mount as launcher } from './launcher.js';
import { mount as notes } from './notes.js';
import { mount as images } from './images.js';

export const widgets = {
  // v1
  todo, projects, research, terminal, pet, media, sys, tech, anime,
  // v2
  pomodoro, water, meals, schedule, launcher, notes, images,
};
