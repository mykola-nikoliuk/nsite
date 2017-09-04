export {Animation} from './Animation';
export {Keyframe} from './Keyframe';
export {ENUMS} from './enums';

import * as THREE from 'three';
import each from 'lodash/each';
import get from 'lodash/get';
import find from 'lodash/find';
import filter from 'lodash/filter';
import {Animation} from './Animation';
import {ENUMS} from './enums';

export default class AnimationManager {
  /**
   * @param render {function}
   * @param onRenderOn {function}
   * @param onRenderOff {function}
   */
  constructor({render, onRenderOn, onRenderOff} = {}) {
    this.render = render;
    this.onRenderOn = onRenderOn;
    this.onRenderOff = onRenderOff;

    this.animations = [];
  }
  /**
   * add animation and guarantied update queue
   * @param animation {Animation}
   * @return {Animation}
   */
  animate(animation) {
    if (animation instanceof Animation) {
      if (this.animations.indexOf(animation) < 0) {
        const isUpdateEnabled = this.onRenderOn && this._isNeedToUpdate();
        animation.currentTime = 0;
        this.animations.push(animation);
        if (this.onRenderOn && !isUpdateEnabled && this._isNeedToUpdate()) {
          this.onRenderOn(this);
        }
        return animation;
      } else {
        throw new Error('AnimationManager:animate() : animation already playing, wait until it will end');
      }
    } else {
      throw new Error('AnimationManager:animate() : animation should be instance of Animation');
    }
  }
  /**
   * update animation
   * @param delta {number}
   */
  update(delta) {
    if (typeof delta === 'number' && delta > 0) {
      const removeAnimations = [];
      each(this.animations, animation => {
        if (animation.hasAttribute(ENUMS.ENABLE)) {
          animation.currentTime += delta;
        }
        const {currentTime, duration, delay, target, keyframes, timeFunction, updateFunctions, onEnd, onLoop} = animation;
        const timeProgress = AnimationManager._getTimeProgress(currentTime, delay, duration, animation);
        const progress = AnimationManager._getProgress(timeFunction, timeProgress, animation);

        if (progress >= 0 && progress <= 1) {
          each(updateFunctions, (updateFunction, key) => {
            const keyframeRange = this._getFromToByField(key, keyframes, progress);

            if (keyframeRange.progress >= 0) {
              const keyTokens = key.split('.');
              const subKey = keyTokens.pop();
              const subPath = keyTokens.join('.');
              const subTarget = subPath.length ? get(target, keyTokens.join('.'), null) : target;
              if (subTarget) {
                updateFunction(subTarget, subKey, keyframeRange);
              } else {
                throw new Error(`AnimationManager:update() : can't resolve path "${key}"`);
              }
            }
          });
        }

        if ((progress === 1 && !animation.reversed) || (progress === 0 && animation.reversed)) {
          if (animation.hasAttribute(ENUMS.LOOP)) {
            animation.currentTime = 0;
            if (animation.hasAttribute(ENUMS.SWING)) {
              animation.reversed = !animation.reversed;
            }
            onLoop();
          }
          else {
            removeAnimations.push(animation);
            onEnd();
          }
        }
      });
      if (removeAnimations.length) {
        this.animations = filter(this.animations, animation => removeAnimations.indexOf(animation) === -1);
        if (this.onRenderOff && !this._isNeedToUpdate()) {
          this.onRenderOff(this);
        }
      }
      this.render && this.render();
    }
  }
  /**
   * @param animation {Animation}
   */
  pause(animation) {
    const isUpdateEnabled = this.onRenderOff && this._isNeedToUpdate();
    animation.removeAttribute(ENUMS.ENABLE);
    if (this.onRenderOff && isUpdateEnabled && !this._isNeedToUpdate()) {
      this.onRenderOff(this);
    }
  }
  /**
   * @param animation {Animation}
   */
  resume(animation) {
    const isUpdateEnabled = this.onRenderOn && this._isNeedToUpdate();
    animation.setAttribute(ENUMS.ENABLE);
    if (this.onRenderOn && !isUpdateEnabled && !this._isNeedToUpdate()) {
      this.onRenderOn(this);
    }
  }
  /**
   *
   * @param animation
   */
  remove(animation) {
    const index = this.animations.indexOf(animation);

    if (index !== -1) {
      this.animations.splice(index, 1);
    }
  }

  has(animation) {
    return this.animations.indexOf(animation) > -1;
  }

  _isNeedToUpdate() {
    return !!find(this.animations, animation => animation.hasAttribute(ENUMS.ENABLE));
  }

  _getFromToByField(field, keyframes, progress) {
    let nearPreviousFrame = null;
    let nearNextFrame = null;
    let localProgress = -1;

    each(keyframes, keyframe => {
      if (typeof keyframe.modificators[field] !== 'undefined') {
        if (keyframe.percent <= progress && (nearPreviousFrame === null || keyframe.percent > nearPreviousFrame.percent)) {
          nearPreviousFrame = keyframe;
        }
        if (keyframe.percent >= progress && (nearNextFrame === null || keyframe.percent < nearNextFrame.percent)) {
          nearNextFrame = keyframe;
        }
      }
    });

    if (nearPreviousFrame) {
      if (nearNextFrame) {
        const deltaKeyframe = nearNextFrame.percent - nearPreviousFrame.percent;
        if (deltaKeyframe === 0) {
          localProgress = 1;
        } else {
          localProgress = (progress - nearPreviousFrame.percent) / deltaKeyframe;
        }
      } else {
        localProgress = 0;
      }
    }

    return {
      from: nearPreviousFrame ? nearPreviousFrame.modificators[field] : null,
      to: nearNextFrame ? nearNextFrame.modificators[field] : null,
      progress: localProgress
    };
  }

  static _getTimeProgress(time, delay, duration, animation) {
    let timeProgress = (time - delay) / duration;
    if (animation.reversed) {
      timeProgress = 1 - timeProgress;
    }
    if (timeProgress >= 1 && !animation.reversed) {
      timeProgress = 1;
    }
    if (timeProgress <= 0 && animation.reversed) {
      timeProgress = 0;
    }
    return timeProgress;
  }

  static _getProgress(timeFunction, timeProgress, animation) {
    let progress = timeFunction(timeProgress);
    if (progress >= 1 && !animation.reversed) {
      progress = 1;
    }
    if (progress <= 0 && animation.reversed) {
      progress = 0;
    }
    return progress;
  }
}

export function UPDATE_VECTOR3(target, field, {from, to, progress}) {
  target = target[field];
  let res;
  switch (progress) {
    case 0:
      res = from;
      break;

    case 1:
      res = to;
      break;

    default:
      res = new THREE.Vector3()
        .subVectors(to, from)
        .multiplyScalar(progress)
        .add(from);
      break;
  }
  target.set(res.x, res.y, res.z);
}

export function UPDATE_NUMBER(target, field, {from, to, progress}) {
  switch (progress) {
    case 0:
      target[field] = from;
      break;

    case 1:
      target[field] = to;
      break;

    default:
      target[field] = (to - from) * progress + from;
  }
}

export function UPDATE_BOOL(target, field, {from}) {
  target[field] = from;
}

export function UPDATE_PATTERN(pattern) {
  return (target, field, {from, to, progress}) => {
    let updatedPattern = pattern;
    let res;
    switch (progress) {
      case 0:
        res = from;
        break;

      case 1:
        res = to;
        break;

      default:
        res = [];
        each(to, (value, index) => {
          const delta = to[index] - from[index];
          let newValue = delta * progress + from[index];
          res.push(newValue);
        });
        break;
    }
    each(res, (value, index) => {
      updatedPattern = updatedPattern.replace(`{${index}}`, value);
    });
    target[field] = updatedPattern;
  };
}
