import assert from 'node:assert/strict'

class FakeStyle {
  constructor() {
    this.values = new Map()
    this.height = ''
    this.bottom = ''
  }
  setProperty(name, value) { this.values.set(name, String(value)) }
  getPropertyValue(name) { return this.values.get(name) || '' }
}

class FakeElement extends EventTarget {
  constructor(tagName = 'div', rect = {}) {
    super()
    this.tagName = tagName.toUpperCase()
    this.id = ''
    this.className = ''
    this.dataset = {}
    this.style = new FakeStyle()
    this.attributes = new Map()
    this.parentElement = null
    this.children = []
    this.rect = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, ...rect }
  }
  append(child) { child.parentElement = this; this.children.push(child) }
  contains(candidate) { return candidate === this || this.children.some((child) => child.contains(candidate)) }
  querySelector(selector) {
    if (selector === '.reading-ruler-handle') return this.children.find((child) => child.className === 'reading-ruler-handle') || null
    return null
  }
  getBoundingClientRect() {
    if (this.id === 'lumi-reading-ruler') {
      const height = Number.parseFloat(this.style.height) || this.rect.height
      const bottomInset = Number.parseFloat(this.style.bottom) || 0
      const bottom = window.innerHeight - bottomInset
      return { left: 10, right: window.innerWidth - 10, top: bottom - height, bottom, width: window.innerWidth - 20, height }
    }
    return { ...this.rect }
  }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  hasAttribute(name) { return this.attributes.has(name) }
  matches() { return false }
  setPointerCapture() {}
  hasPointerCapture() { return false }
  releasePointerCapture() {}
}

class FakeStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
}
class FakeWindow extends EventTarget {}

const fakeWindow = new FakeWindow()
fakeWindow.innerWidth = 1130
fakeWindow.innerHeight = 1038
fakeWindow.location = { pathname: '/chat/test', hash: '', search: '' }
fakeWindow.localStorage = new FakeStorage()
fakeWindow.PointerEvent = class PointerEvent {}
fakeWindow.setInterval = setInterval
fakeWindow.clearInterval = clearInterval

const body = new FakeElement('body', { left: 0, top: 0, right: 1130, bottom: 1038, width: 1130, height: 1038 })
const root = new FakeElement('html', { left: 0, top: 0, right: 1130, bottom: 1038, width: 1130, height: 1038 })
const input = new FakeElement('div', { left: 28, top: 939, right: 1113, bottom: 1034, width: 1085, height: 95 })
input.setAttribute('data-component', 'InputArea')
input.className = 'input-area'
input.parentElement = body

// Mirrors current Lumiverse ViewportDrawer when closed: the drawer remains mounted,
// but the wrapper transform moves the panel so its left edge is exactly at vw.
const drawer = new FakeElement('div', { left: 1130, top: 0, right: 1550, bottom: 1038, width: 420, height: 1038 })
drawer.className = '_drawer_1i7fc_89'
drawer.parentElement = body

let ruler = null
let handle = null
const document = {
  body,
  documentElement: root,
  querySelector(selector) {
    if (selector.includes('[data-component="InputArea"]')) return input
    return null
  },
  querySelectorAll(selector) {
    if (selector.includes('[data-component="InputArea"]')) return [input]
    if (selector.includes('[class*="drawer" i]')) return [drawer]
    return []
  },
  getElementById(id) { return id === 'lumi-reading-ruler' ? ruler : null },
  elementsFromPoint() { return [] },
}

fakeWindow.getComputedStyle = (element) => ({
  height: element?.style?.height || `${element?.rect?.height || 0}px`,
  display: 'block', visibility: 'visible', opacity: '1',
  position: element === input ? 'fixed' : 'static',
  zIndex: element === drawer ? '9992' : '0',
  getPropertyValue(name) { return element?.style?.getPropertyValue?.(name) || root.style.getPropertyValue(name) || '' },
})

globalThis.window = fakeWindow
globalThis.document = document
globalThis.HTMLElement = FakeElement
globalThis.MutationObserver = class { observe() {} disconnect() {} }
let frameId = 0
globalThis.requestAnimationFrame = (callback) => { callback(); frameId += 1; return frameId }
globalThis.cancelAnimationFrame = () => {}

const { setup } = await import('../dist/frontend.js')
const ctx = {
  dom: {
    addStyle() { return () => {} },
    inject() {
      ruler = new FakeElement('div', { height: 180 })
      ruler.id = 'lumi-reading-ruler'
      ruler.parentElement = body
      handle = new FakeElement('button', { left: 28, top: 700, right: 1113, bottom: 758, width: 1085, height: 58 })
      handle.className = 'reading-ruler-handle'
      ruler.append(handle)
      return ruler
    },
    uninject() {}, cleanup() {},
  },
  ui: {},
}

const cleanup = setup(ctx)
assert.equal(ruler.dataset.active, 'true', 'closed offscreen drawer must not suppress the ruler')
assert.equal(ruler.dataset.reason, 'active')
assert.equal(ruler.dataset.blocker, '')

// Move the same always-mounted drawer onscreen, matching its open state.
drawer.rect = { left: 710, top: 0, right: 1130, bottom: 1038, width: 420, height: 1038 }
fakeWindow.dispatchEvent(new Event('resize'))
assert.equal(ruler.dataset.active, 'false', 'open onscreen drawer should still yield')
assert.equal(ruler.dataset.reason, 'blocked-ui')
assert.match(ruler.dataset.blocker, /drawer/)

// Close it again: visibility should recover without remounting the extension.
drawer.rect = { left: 1130, top: 0, right: 1550, bottom: 1038, width: 420, height: 1038 }
fakeWindow.dispatchEvent(new Event('resize'))
assert.equal(ruler.dataset.active, 'true', 'closing the drawer should restore the ruler')
assert.equal(ruler.dataset.reason, 'active')

cleanup()
console.log('offscreen drawer yielding: ok')
