// CONSTANTS: CHANGE THESE
// Number of reflected sides
const sides = 7;
// Radius of the dot we're drawing.
const radius = 5;
// (100 - ?) The timing, in ms, of the feedback delay.
// If you bring this number way down you might
// want to turn `fadeout` up to 0.4 or 0.5.
const delay = 1500;
// (0 - 1) how much opacity to apply on each
// frame to clear the screen. Lower = slower,
// higher = faster.
const fadeout = 0.1;
// (0 - 360) Hue, in degrees, of the dot you're
// currently drawing.
const colorStart = 0;
// (0 - ?) How far should the color rotate across
// the reflected sides? 360 = one full rainbow.
const colorSpread = 360;

// SETUP
// We'll use this ID to make the feedback loop erasable.
let lastId = 0;
// Maybe scale the canvas for a retina display.
const scale = window.devicePixelRatio;
// Grab the canvas and set the width and height.
const canvasElement = document.getElementById('canvas');
canvas.width = window.innerWidth * scale;
canvas.height = window.innerHeight * scale;
const context = canvas.getContext('2d');

// An erase function we'll use when the window gets resized.
const erase = () => context.clearRect(0, 0, window.innerWidth * scale, window.innerHeight * scale);

// On resize set the canvas width & height so there's no stretching.
window.onresize = () => {
  canvasElement.width = window.innerWidth * scale;
  canvasElement.height = window.innerHeight * scale;
};

// STREAMS
// A stream of mouse movement.
const mouseMovement = Rx.Observable.fromEvent(document.querySelector('body'), 'mousemove');
// For some reason `fromEvent` isn't working for touchmove so we'll make our own stream.
const touchMovement = new Rx.Subject();
document.addEventListener('touchmove', e => {
  e.stopPropagation();
  touchMovement.next(e);
});
// A special stream that will create a feedback loop,
// continuously processing the same information on
// a delay.
const feedback = new Rx.Subject();
// A stream of clear button clicks.
const clearDrawing = Rx.Observable.fromEvent(document.querySelector('#clear'), 'click');
// A stream of requestAnimationFrame callbacks for doing work at 60fps.
const frames = Rx.Observable.create(observable => {
  const frame = () => {
    window.requestAnimationFrame(frame);
    observable.next();
  }
  frame();
});

// LOGIC
// Using the mouse movement as input we're going to set up
// a feedback loop that endlessly replays our event data.
mouseMovement
  .merge(touchMovement)
  // Only send movement events if the mouse button is pressed or if it's a touch event.
  .filter(e => {
    if (e.targetTouches) return true;
    return e.button === 1 || e.which === 1;
  })
  // We don't want or need to pass the full event object around
  // so we map the stream to only the values we need. We also
  // assign an ID before we enter the feedback loop, which allows
  // us to clear the current drawings by filtering out old IDs.
  .map(e => {
      if (e.targetTouches) return { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY, id: lastId };
      return { x: e.clientX, y: e.clientY, id: lastId };
  })
  // Merge the feedback stream into this one, allowing us to
  // replay previously observed events as if they were new.
  .merge(feedback)
  // Now we're in feedback territory! Filter out any events with
  // an old ID. The ID will be incremented using the clear button.
  .filter(e => e.id === lastId)
  // On each event draw the coordinates to the canvas. We're mapping
  // here rather than subscribing because we still have to pipe
  // the data into the feedback loop. If we subscribed we wouldn't
  // be able to further modify the stream.
  .map(e => {
    // We're going to draw the data once for every symmetrical side.
    for(let i = 0; i < sides; i++) {
      // rotate the original coordinates around the center of the canvas.
      const { rx, ry } = rotateAroundCenter(e.x, e.y, (Math.PI * 2) / sides * i);
      // Set the hue based on the current rotation.
      context.fillStyle = `hsl(${colorStart + (colorSpread / sides * i)}, 100%, 50%)`;
      // Draw a circle •
      context.beginPath();
      context.arc(rx * scale, ry * scale, radius, 0, Math.PI * 2);
      context.fill();
    }
    // We're using map so we must return the event.
    return e;
  })
  // Delay the event for the specified number of ms.
  .delay(Math.max(100, delay))
  // Take the delayed event and push it into the feedback stream.
  .subscribe(e => feedback.next(e));

// when the clear button is pressed we increment
// the lastId, filtering out any old events.
clearDrawing.subscribe(e => {
  lastId = lastId + 1;
  erase();
});

// Each frame, fade the canvas out a bit by putting a
// semi-transparent white box over everything. The
// `fadeout` const determines how much opacity to apply.
frames.subscribe(() => {
  context.fillStyle = `rgba(15, 15, 15, ${fadeout})`;
  context.fillRect(0, 0, window.innerWidth * scale, window.innerHeight * scale);
})

// HELPERS
// A function for rotating a point around the center
// of the canvas by `angle` radians. We're working with
// screen coordinates here — not canvas coordinates —
// so we don't apply the `scale`.
function rotateAroundCenter(xpos, ypos, angle) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const rx = Math.cos(angle) * (xpos - cx) - Math.sin(angle) * (ypos - cy) + cx;
  const ry = Math.sin(angle) * (xpos - cx) + Math.cos(angle) * (ypos - cy) + cy;
  return { rx, ry };
}