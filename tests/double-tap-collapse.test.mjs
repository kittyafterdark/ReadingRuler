import assert from 'node:assert/strict'

class FakeStyle {
  constructor() {
    this.values = new Map()
    this.height = ''
    this.bottom = ''
  }

  setProperty(name, value) {
    this.values.set(name, String(value))
  }

  getPropertyValue(name) {
    return this.values.get(name) || ''
  }
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
    this.capturedPointerId = null
    this.rect = {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
      ...rect,
    }
  }

  append(child) {
    child.parentElement = this
    this.children.push(child)
  }

  contains(candidate) {
    if (candidate === this) return true
    return this.children.some((child) => child.contains(candidate))
  }

  querySelector(selector) {
    if (selector === '.reading-ruler-handle') {
      return this.children.find((child) => child.className === 'reading-ruler-handle') || null
    }
    return null
  }

  getBoundingClientRect() {
    if (this.id === 'lumi-reading-ruler') {
      const height = Number.parseFloat(this.style.height) || this.rect.height
      const bottomInset = Number.parseFloat(this.style.bottom) || 0
      const bottom = window.innerHeight - bottomInset
      return {
        left: 10,
        right: window.innerWidth - 10,
        top: bottom - height,
        bottom,
        width: window.innerWidth - 20,
        height,
      }
    }
    return { ...this.rect }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  matches() {
    return false
  }

  setPointerCapture(pointerId) {
    this.capturedPointerId = pointerId
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointerId === pointerId
  }

  releasePointerCapture(pointerId) {
    if (this.capturedPointerId === pointerId) this.capturedPointerId = null
  }
}

class FakeStorage {
  constructor() {
    this.map = new Map()
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null
  }

  setItem(key, value) {
    this.map.set(key, String(value))
  }
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
    return []
  },
  getElementById(id) {
    return id === 'lumi-reading-ruler' ? ruler : null
  },
  elementsFromPoint() {
    return []
  },
}

fakeWindow.getComputedStyle = (element) => {
  const height = element?.style?.height || `${element?.rect?.height || 0}px`
  return {
    height,
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: element === input ? 'fixed' : 'static',
    zIndex: '0',
    getPropertyValue(name) {
      return element?.style?.getPropertyValue?.(name) || root.style.getPropertyValue(name) || ''
    },
  }
}

globalThis.window = fakeWindow
globalThis.document = document
globalThis.HTMLElement = FakeElement
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
}

let frameId = 0
globalThis.requestAnimationFrame = (callback) => {
  callback()
  frameId += 1
  return frameId
}
globalThis.cancelAnimationFrame = () => {}

function pointerEvent(type, clientY, pointerId = 1) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'clientY', { value: clientY })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event
}

fakeWindow.localStorage.setItem('lumi-reading-ruler-v3-height', '180')

const { setup } = await import('../dist/frontend.js')
const ctx = {
  dom: {
    addStyle() {
      return () => {}
    },
    inject() {
      ruler = new FakeElement('div', { height: 180 })
      ruler.id = 'lumi-reading-ruler'
      ruler.parentElement = body
      handle = new FakeElement('button', { left: 28, top: 700, right: 1113, bottom: 758, width: 1085, height: 58 })
      handle.className = 'reading-ruler-handle'
      ruler.append(handle)
      return ruler
    },
    uninject() {},
    cleanup() {},
  },
  ui: {},
}

const cleanup = setup(ctx)

assert.equal(ruler.dataset.active, 'true', 'ruler should mount active on a normal chat route')
assert.equal(ruler.style.height, '180px', 'saved height should be restored before gesture tests')

handle.dispatchEvent(pointerEvent('pointerdown', 500))
fakeWindow.dispatchEvent(pointerEvent('pointerup', 500))
assert.equal(ruler.style.height, '180px', 'one tap must not collapse the ruler')

handle.dispatchEvent(pointerEvent('pointerdown', 500))
fakeWindow.dispatchEvent(pointerEvent('pointerup', 500))
assert.equal(ruler.style.height, '38px', 'second clean tap should collapse to the themed minimum')
assert.equal(fakeWindow.localStorage.getItem('lumi-reading-ruler-v3-height'), '38', 'collapsed height should persist')

handle.dispatchEvent(pointerEvent('pointerdown', 500))
fakeWindow.dispatchEvent(pointerEvent('pointermove', 400))
fakeWindow.dispatchEvent(pointerEvent('pointerup', 400))
assert.equal(ruler.style.height, '138px', 'drag should still resize normally')

handle.dispatchEvent(pointerEvent('pointerdown', 400))
fakeWindow.dispatchEvent(pointerEvent('pointerup', 400))
assert.equal(ruler.style.height, '138px', 'a drag followed by one tap must not be misread as a double tap')

handle.dispatchEvent(pointerEvent('pointerdown', 400))
fakeWindow.dispatchEvent(pointerEvent('pointerup', 400))
assert.equal(ruler.style.height, '38px', 'a fresh second tap after the drag should collapse normally')

cleanup()
console.log('double-tap collapse gesture: ok')
