import '@testing-library/jest-dom'

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillStyle: '#ffffff',
    strokeStyle: '#000000',
    lineCap: 'round',
    lineJoin: 'round',
    lineWidth: 1,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fillRect: () => undefined,
  }),
})
