import { Timer } from "three/src/core/Timer.js";

/** Clock API required by Fiber 9, backed by Three's supported Timer. */
export class Clock {
  autoStart: boolean;
  startTime = 0;
  oldTime = 0;
  elapsedTime = 0;
  running = false;
  private readonly timer = new Timer();

  constructor(autoStart = true) {
    this.autoStart = autoStart;
  }
  start() {
    this.startTime = this.oldTime = performance.now();
    this.timer.reset();
    this.elapsedTime = 0;
    this.running = true;
  }
  stop() {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }
  getDelta() {
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    if (!this.running) return 0;
    this.timer.update();
    const delta = this.timer.getDelta();
    this.oldTime = performance.now();
    this.elapsedTime += delta;
    return delta;
  }
  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }
}
