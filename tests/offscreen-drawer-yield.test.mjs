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
  append(child) { return this.appendChild(child) }
  appendChild(child) {
    if (child.parentElement && child.parentElement !== this) {
      child.parentElement.children = child.parentElement.children.filter((item) => item !== child)
    }
    child.parentElement = this
    if (!this.children.includes(child)) this.children.push(child)
    return child
  }
  get isConnected() {
    let node = this
    while (node) {
      if (node === body) return true
      node = node.parentElement
    }
    return false
  }
  closest(selector) {
    const ownerAttrs = ['data-spindle-ext', 'data-spindle-extension-root', 'data-spindle-extension-id', 'data-spindle-ext-id']
    let node = this
    while (node) {
      if (ownerAttrs.some((attr) => selector.includes(attr) && node.hasAttribute?.(attr))) return node
      node = node.parentElement
    }
    return null
  }
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
body.append(input)

const chatSurfaceMount = new FakeElement('div')
chatSurfaceMount.setAttribute('data-spindle-mount', 'chat_surface_side')
body.append(chatSurfaceMount)

// A peer extension control that overlaps the ruler. This used to be misclassified
// as Lumiverse chrome because its class contains "sidebar".
const peerExtensionRoot = new FakeElement('div')
peerExtensionRoot.setAttribute('data-spindle-ext', 'sidebar-ux-test')
const peerResizeHandle = new FakeElement('div', { left: 830, top: 820, right: 846, bottom: 930, width: 16, height: 110 })
peerResizeHandle.className = 'sidebar-ux-resize-handle'
peerExtensionRoot.append(peerResizeHandle)
body.append(peerExtensionRoot)

// Mirrors current Lumiverse ViewportDrawer when closed: the drawer remains mounted,
// but the wrapper transform moves the panel so its left edge is exactly at vw.
const drawer = new FakeElement('div', { left: 1130, top: 0, right: 1550, bottom: 1038, width: 420, height: 1038 })
drawer.className = '_drawer_1i7fc_89'
body.append(drawer)

let ruler = null
let handle = null
let injectionWrapper = null
let injectedCss = ''
const document = {
  body,
  documentElement: root,
  querySelector(selector) {
    if (selector.includes('[data-component="InputArea"]')) return input
    if (selector === '[data-spindle-mount="chat_surface_side"]') return chatSurfaceMount
    return null
  },
  querySelectorAll(selector) {
    if (selector.includes('[data-component="InputArea"]')) return [input]
    if (selector.includes('[class*="drawer" i]')) return [drawer, peerResizeHandle]
    return []
  },
  getElementById(id) { return id === 'lumi-reading-ruler' ? ruler : null },
  elementsFromPoint() { return [] },
}

fakeWindow.getComputedStyle = (element) => ({
  height: element?.style?.height || `${element?.rect?.height || 0}px`,
  display: 'block', visibility: 'visible', opacity: '1',
  position: element === input || element === peerResizeHandle ? 'fixed' : 'static',
  zIndex: element === drawer || element === peerResizeHandle ? '9992' : '0',
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
    addStyle(css) { injectedCss = css; return () => {} },
    inject() {
      const wrapper = new FakeElement('div')
      injectionWrapper = wrapper
      wrapper.setAttribute('data-spindle-ext', 'reading-ruler-test')
      ruler = new FakeElement('div', { height: 180 })
      ruler.id = 'lumi-reading-ruler'
      handle = new FakeElement('button', { left: 28, top: 700, right: 1113, bottom: 758, width: 1085, height: 58 })
      handle.className = 'reading-ruler-handle'
      ruler.append(handle)
      wrapper.append(ruler)
      body.append(wrapper)
      return wrapper
    },
    uninject() {}, cleanup() {},
  },
  ui: {},
}

const cleanup = setup(ctx)
assert.equal(injectionWrapper.parentElement, chatSurfaceMount, 'ruler wrapper should move into the chat_surface_side mount')
assert.equal(ruler.dataset.active, 'true', 'closed offscreen drawer and peer extension UI must not suppress the ruler')
assert.equal(ruler.dataset.reason, 'active')
assert.equal(ruler.dataset.blocker, '')
assert.match(injectedCss, /top:\s*var\(--lrr-handle-hit-top, 0px\)/, 'handle hitbox should stay inside the ruler by default')
assert.match(injectedCss, /height:\s*var\(--lrr-handle-hit-height, 28px\)/, 'handle hitbox should not float over readable text')
assert.match(injectedCss, /top:\s*var\(--lrr-handle-top, 6px\)/, 'visible pill should be docked inside the ruler top edge')

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
