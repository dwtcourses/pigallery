// @ts-nocheck
let instance = 0;
let CSScreated = false;

let theme = {
  background: 'darkslategray',
  hover: 'lightgray',
  itemBackground: 'black',
  itemColor: 'white',
  buttonBackground: 'lightblue',
  buttonHover: 'lightgreen',
  checkboxOn: 'lightgreen',
  checkboxOff: 'lightcoral',
  rangeBackground: 'lightblue',
  rangeLabel: 'white',
};

function createCSS() {
  if (CSScreated) return;
  const css = `
  .menu { position: fixed; top: 0rem; right: 0; width: fit-content; padding: 0 0.8rem 0 0.8rem; line-height: 1.8rem; z-index: 50; max-height: calc(100% - 4rem);
          box-shadow: 0 0 8px dimgrey; background: ${theme.background}; border-radius: 1rem; border-color: black; border-style: solid; border-width: thin; }

  .menu:hover { box-shadow: 0 0 8px ${theme.hover}; }
  .menu-container { display: block; max-height: 100vh; }
  .menu-container-fadeout { max-height: 0; overflow: hidden; transition: max-height, 0.5s ease; }
  .menu-container-fadein { max-height: 100vh; overflow: hidden; transition: max-height, 0.5s ease; }
  .menu-item { display: flex; white-space: nowrap; padding: 0.2rem; width: max-content; cursor: default; }
  .menu-title { text-align: right; cursor: pointer; }
  .menu-hr { margin: 0.2rem; border: 1px solid rgba(0, 0, 0, 0.5) }
  .menu-label { padding: 0; }

  .menu-list { margin-right: 0.8rem; }
  select:focus { outline: none; }
  .menu-list-item { background: ${theme.itemBackground}; color: ${theme.itemColor}; border: none; padding: 0.2rem; font-family: inherit; font-variant: inherit; border-radius: 1rem; }

  .menu-chart-title { padding: 0; font-size: 0.8rem; font-weight: 800; align-items: center}
  .menu-chart-canvas { background: transparent; margin: 0.2rem 0 0.2rem 0.6rem; }
  
  .menu-button { border: 0; background: ${theme.buttonBackground}; width: -webkit-fill-available; padding: 8px; margin: 8px 0 8px 0; cursor: pointer; box-shadow: 4px 4px 4px 0 dimgrey; border-radius: 1rem; justify-content: center; }
  .menu-button:hover { background: ${theme.buttonHover}; box-shadow: 4px 4px 4px 0 black; }
  .menu-button:focus { outline: none; }

  .menu-checkbox { width: 2.8rem; height: 1rem; background: ${theme.itemBackground}; margin: 0.5rem 0.8rem 0 0; position: relative; border-radius: 1rem; }
  .menu-checkbox:after { content: 'OFF'; color: ${theme.checkboxOff}; position: absolute; right: 0.2rem; top: -0.4rem; font-weight: 800; font-size: 0.5rem; }
  .menu-checkbox:before { content: 'ON'; color: ${theme.checkboxOn}; position: absolute; left: 0.3rem; top: -0.4rem; font-weight: 800; font-size: 0.5rem; }
  .menu-checkbox-label { width: 1.3rem; height: 0.8rem; cursor: pointer; position: absolute; top: 0.1rem; left: 0.1rem; z-index: 1; background: ${theme.checkboxOff}; border-radius: 1rem; transition: left 0.6s ease; }
  input[type=checkbox] { visibility: hidden; }
  input[type=checkbox]:checked + label { left: 1.4rem; background: ${theme.checkboxOn}; }

  .menu-range { margin: 0 0.8rem 0 0; width: 5rem; background: transparent; color: ${theme.rangeBackground}; }
  .menu-range:before { content: attr(value); color: ${theme.rangeLabel}; margin: 0 0.4rem 0 0; font-weight: 800; font-size: 0.6rem; position: relative; }
  input[type=range] { -webkit-appearance: none; }
  input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 1rem; cursor: pointer; background: ${theme.itemBackground}; border-radius: 1rem; border: 1px; }
  input[type=range]::-webkit-slider-thumb { border: 1px solid #000000; margin-top: 0.05rem; height: 0.9rem; width: 1.5rem; border-radius: 1rem; background: ${theme.rangeBackground}; cursor: pointer; -webkit-appearance: none; }
  `;
  const el = document.createElement('style');
  el.innerHTML = css;
  document.getElementsByTagName('head')[0].appendChild(el);
  CSScreated = true;
}

class Menu {
  constructor(parent, title, position, userTheme) {
    if (userTheme) theme = { ...theme, ...userTheme };
    createCSS();
    this.createMenu(parent, title, position);
    this.id = 0;
    this.instance = instance;
    instance++;
    this._maxFPS = 0;
    this.hidden = 0;
    this.chartFGcolor = 'lightblue';
    this.chartBGcolor = 'lightgray';
  }

  createMenu(parent, title = '', position = { top: null, left: null, bottom: null, right: null }) {
    this.menu = document.createElement('div');
    this.menu.id = `menu-${instance}`;
    this.menu.className = 'menu';
    if (position) {
      if (position.top) this.menu.style.top = position.top;
      if (position.bottom) this.menu.style.bottom = position.bottom;
      if (position.left) this.menu.style.left = position.left;
      if (position.right) this.menu.style.right = position.right;
    }

    this.container = document.createElement('div');
    this.container.id = `menu-container-${instance}`;
    this.container.className = 'menu-container menu-container-fadein';

    if (title !== '') {
      const elTitle = document.createElement('div');
      elTitle.className = 'menu-title';
      elTitle.id = `menu-title-${instance}`;
      elTitle.innerHTML = title;
      this.menu.appendChild(elTitle);
      elTitle.addEventListener('click', () => {
        this.container.classList.toggle('menu-container-fadeout');
        this.container.classList.toggle('menu-container-fadein');
        this.menu.style.borderStyle = this.container.classList.contains('menu-container-fadeout') ? 'none' : 'solid';
      });
    }
    this.menu.appendChild(this.container);
    if (typeof parent === 'object') parent.appendChild(this.menu);
    else document.getElementById(parent).appendChild(this.menu);
  }

  get newID() {
    this.id++;
    return `menu-${this.instance}-${this.id}`;
  }

  get ID() {
    return `menu-${this.instance}-${this.id}`;
  }

  get width() {
    return this.menu.offsetWidth;
  }

  get height() {
    return this.menu.offsetHeight;
  }

  hide() {
    if (this.container.classList.contains('menu-container-fadein')) {
      this.container.classList.toggle('menu-container-fadeout');
      this.container.classList.toggle('menu-container-fadein');
    }
  }

  visible() {
    return (this.container.classList.contains('menu-container-fadein'));
  }

  toggle(evt) {
    this.container.classList.toggle('menu-container-fadeout');
    this.container.classList.toggle('menu-container-fadein');
    if (this.container.classList.contains('menu-container-fadein') && evt) {
      const x = evt.x || (evt.touches && evt.touches[0] ? evt.touches[0].pageX : null);
      const y = evt.y || (evt.touches && evt.touches[0] ? evt.touches[0].pageY : null);
      if (x) this.menu.style.left = `${x - 105}px`;
      if (y) this.menu.style.top = '5.5rem'; // `${evt.y + 55}px`;
      if (this.menu.offsetLeft < 0) this.menu.style.left = '0';
      if ((this.menu.offsetLeft + this.menu.offsetWidth) > window.innerWidth) {
        this.menu.style.left = '';
        this.menu.style.right = '0';
      }
      this.menu.style.borderStyle = 'solid';
    } else {
      this.menu.style.borderStyle = 'none';
    }
  }

  addTitle(title) {
    const el = document.createElement('div');
    el.className = 'menu-title';
    el.id = this.newID;
    el.innerHTML = title;
    this.menu.appendChild(el);
    el.addEventListener('click', () => {
      this.hidden = !this.hidden;
      const all = document.getElementsByClassName('menu');
      for (const item of all) {
        item.style.display = this.hidden ? 'none' : 'block';
      }
    });
  }

  addLabel(title) {
    const el = document.createElement('div');
    el.className = 'menu-item menu-label';
    el.id = this.newID;
    el.innerHTML = title;
    this.container.appendChild(el);
  }

  addBool(title, object, variable, callback) {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.innerHTML = `<div class="menu-checkbox"><input class="menu-checkbox" type="checkbox" id="${this.newID}" ${object[variable] ? 'checked' : ''}/><label class="menu-checkbox-label" for="${this.ID}"></label></div>${title}`;
    this.container.appendChild(el);
    el.addEventListener('change', (evt) => {
      object[variable] = evt.target.checked;
      if (callback) callback(evt.target.checked);
    });
  }

  async addList(title, items, selected, callback) {
    const el = document.createElement('div');
    el.className = 'menu-item';
    let options = '';
    for (const item of items) {
      const def = item === selected ? 'selected' : '';
      options += `<option value="${item}" ${def}>${item}</option>`;
    }
    el.innerHTML = `<div class="menu-list"><select name="${this.ID}" class="menu-list-item">${options}</select><label for="${this.ID}"></label></div>${title}`;
    el.style.fontFamily = document.body.style.fontFamily;
    el.style.fontSize = document.body.style.fontSize;
    el.style.fontVariant = document.body.style.fontVariant;
    this.container.appendChild(el);
    el.addEventListener('change', (evt) => {
      if (callback) callback(items[evt.target.selectedIndex]);
    });
  }

  addRange(title, object, variable, min, max, step, callback) {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.innerHTML = `<input class="menu-range" type="range" id="${this.newID}" min="${min}" max="${max}" step="${step}" value="${object[variable]}">${title}`;
    this.container.appendChild(el);
    el.addEventListener('change', (evt) => {
      object[variable] = evt.target.value;
      evt.target.setAttribute('value', evt.target.value);
      if (callback) callback(evt.target.value);
    });
  }

  addHTML(html) {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.id = this.newID;
    if (html) el.innerHTML = html;
    this.container.appendChild(el);
  }

  addButton(titleOn, titleOff, callback) {
    const el = document.createElement('button');
    el.className = 'menu-item menu-button';
    el.style.fontFamily = document.body.style.fontFamily;
    el.style.fontSize = document.body.style.fontSize;
    el.style.fontVariant = document.body.style.fontVariant;
    el.type = 'button';
    el.id = this.newID;
    el.innerText = titleOn;
    this.container.appendChild(el);
    el.addEventListener('click', () => {
      if (el.innerText === titleOn) el.innerText = titleOff;
      else el.innerText = titleOn;
      if (callback) callback(el.innerText !== titleOn);
    });
  }

  addValue(title, val, suffix = '') {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.id = `menu-val-${title}`;
    el.innerText = `${title}: ${val}${suffix}`;
    this.container.appendChild(el);
  }

  // eslint-disable-next-line class-methods-use-this
  updateValue(title, val, suffix = '') {
    const el = document.getElementById(`menu-val-${title}`);
    if (el) el.innerText = `${title}: ${val}${suffix}`;
    else this.addValue(title, val);
  }

  addChart(title, id, width = 200, height = 40, fgColor, bgColor) {
    if (fgColor) this.chartFGcolor = fgColor;
    if (bgColor) this.chartBGcolor = bgColor;
    const el = document.createElement('div');
    el.className = 'menu-item menu-chart-title';
    el.id = this.newID;
    el.innerHTML = `<font color=${this.chartFGcolor}>${title}</font><canvas id="menu-canvas-${id}" class="menu-chart-canvas" width="${width}px" height="${height}px"></canvas>`;
    this.container.appendChild(el);
  }

  // eslint-disable-next-line class-methods-use-this
  async updateChart(id, values) {
    if (!values || (values.length === 0)) return;
    const canvas = document.getElementById(`menu-canvas-${id}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = this.chartBGcolor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width / values.length;
    const max = 1 + Math.max(...values);
    const height = canvas.height / max;
    for (const i in values) {
      const gradient = ctx.createLinearGradient(0, (max - values[i]) * height, 0, 0);
      gradient.addColorStop(0.1, this.chartFGcolor);
      gradient.addColorStop(0.4, this.chartBGcolor);
      ctx.fillStyle = gradient;
      ctx.fillRect(i * width, 0, width - 4, canvas.height);
      ctx.fillStyle = this.chartBGcolor;
      ctx.font = `${width / 1.4}px "Segoe UI"`;
      ctx.fillText(Math.round(values[i]), i * width + 1, canvas.height - 1, width - 1);
    }
  }
}

export default Menu;
