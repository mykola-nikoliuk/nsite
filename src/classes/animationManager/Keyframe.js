import each from "lodash/each";

export class Keyframe {
  /**
   * @param modificators {{}}
   * @param [percent] {number}
   */
  constructor(modificators, percent) {
    this.percent = percent;
    this.modificators = modificators;
    this._checkModificators();
  }

  _checkModificators() {
    each(this.modificators, (value) => {
      if (typeof value === 'undefined') {
        throw new Error('Keyframe:constructor() : modificator must defined');
      }
    });
  }
}
