import each from "lodash/each";
import {ENUMS} from "./enums";

export class Animation {
  /**
   * @param config {{[target]: {}, [keyframes]: [Keyframe], [updateFunctions]: {}, [duration]: number, [delay]: number, [reversed]: bool, [timeFunction]: function, [onEnd]: function, [onLoop]: function, [attributes]: number}}
   */
  constructor(config) {
    const {
      target, keyframes, updateFunctions, duration, delay = 0, reversed = false,
      timeFunction = time => time, onEnd = () => {
      }, onLoop = () => {
      }, attributes = 0
    } = config;
    this.target = target;
    this.keyframes = keyframes;
    this.updateFunctions = updateFunctions;
    this.duration = duration;

    this.delay = delay;
    this.attributes = attributes | ENUMS.ENABLE;
    this.onEnd = onEnd;
    this.onLoop = onLoop;
    this.timeFunction = timeFunction;
    this.currentTime = 0;

    this.reversed = reversed;
    this.config = config;

    this._checkKeyframes();
  }

  reverse() {
    this.reversed = !this.reversed;
    return this;
  }

  clone(config) {
    return new Animation(Object.assign({}, this.config, config));
  }

  setProgress(progress) {
    this.currentTime = this.duration * progress;
    return this;
  }

  hasAttribute(flag) {
    return (this.attributes & flag) === flag;
  }

  setAttribute(flag) {
    this.attributes |= flag;
    return this;
  }

  removeAttribute(flag) {
    this.attributes &= ~flag;
    return this;
  }

  _checkKeyframes() {
    let keyFramesWithoutPercents = 0;
    let previousPercent = 0;

    each(this.keyframes, (keyframe, index) => {
      // TODO: compare updateFunctions and keyframe modificators and add updateFunctions that missed
      if (index === 0) {
        if (keyframe.percent && keyframe.percent !== 0) {
          throw new Error('Animation:animate() : first keyframe must have "percent" field equal undefined or 0');
        }
        else {
          keyframe.percent = 0;
        }
      } else {
        if (index === this.keyframes.length - 1) {
          if (keyframe.percent && keyframe.percent !== 1) {
            throw new Error('Animation:animate() : last keyframe must have "percent" field equal undefined or 1');
          }
          keyframe.percent = 1;
        }

        if (typeof keyframe.percent === 'number') {
          if (keyframe.percent <= previousPercent && keyframe.percent !== 1) {
            throw new Error(`Animation:animate() : wrong queue of "percent". ${typeof keyframe.percent} must be after ${previousPercent}`);
          }
          if (keyFramesWithoutPercents) {
            const step = (keyframe.percent - previousPercent) / (keyFramesWithoutPercents + 1);
            let offset = keyframe.percent - step;
            let indexOffset = 0;
            while (keyFramesWithoutPercents--) {
              this.keyframes[index - ++indexOffset].percent = offset;
              offset -= step;
            }
            keyFramesWithoutPercents = 0;
          }
          previousPercent = keyframe.percent;
        }
        else {
          keyFramesWithoutPercents++;
        }
      }
    });
  }
}
