import usfm from 'usfm-js';
import isEqual from 'deep-equal'
import { getUsfmForVerseContent } from './UsfmFileConversionHelpers'
import { checkSelectionOccurrences } from '../utils/selections'

/**
 * validate selections in verse string or object
 * @param {String|object} targetVerse - target bible verse.
 * @param {array} selections - array of selection objects [Obj,...]
 * @returns {object}
 */
export function validateVerseSelections(targetVerse, selections) {
  if (typeof targetVerse !== 'string') {
    targetVerse = getUsfmForVerseContent(targetVerse)
  }
  const filtered = usfm.removeMarker(targetVerse); // remove USFM markers
  const selectionsResults = _validateVerseSelections(filtered, selections)
  return selectionsResults
}

/**
 * validate selections in verse string
 * @param {String} filteredTargetVerse - target bible verse as string.
 * @param {array} selections - array of selection objects [Obj,...]
 * @returns {object}
 */
function _validateVerseSelections(filteredTargetVerse, selections) {
  const validSelections = checkSelectionOccurrences(filteredTargetVerse, selections);
  const selectionsChanged = (selections.length !== validSelections.length);
  return { selectionsChanged, validSelections }
}

/**
 * verify all selections for current verse
 * @param {string|object} targetVerse - new text for verse
 * @param {string} chapter
 * @param {string} verse
 * @param {string} bookId
 * @param {Object} groupsData - all the checks keyed by catagory
 * @param {Function} invalidateCheckCallback
 * @return {boolean}
 */
export const validateAllSelectionsForVerse = (targetVerse, bookId, chapter, verse, groupsData = null, invalidateCheckCallback = null) => {
  let filtered = null;
  let _validationsChanged = false;

  const groupIds = Object.keys(groupsData)
  for (const groupId of groupIds) {
    const checks = groupsData[groupId]

    for (let j = 0, lenGI = checks.length; j < lenGI; j++) {
      const check = checks[j]
      const selections = check.selections
      const reference = {
        bookId,
        chapter,
        verse
      }

      const contextId = check.contextId
      if (isEqual(reference, contextId?.reference)) {
        if (selections && selections.length) {
          if (!filtered) { // for performance, we filter the verse only once and only if there is a selection
            if (typeof targetVerse !== 'string') {
              targetVerse = getUsfmForVerseContent(targetVerse)
            }
            filtered = usfm.removeMarker(targetVerse) // remove USFM markers
          }

          const { selectionsChanged: currentSelectionsInvalid } = _validateVerseSelections(filtered, selections)
          if (!!check.invalidated !== !!currentSelectionsInvalid) {
            _validationsChanged = true
          }
          // callback
          invalidateCheckCallback && invalidateCheckCallback(check, currentSelectionsInvalid)
        } else { // no selections, so not invalid
          const currentSelectionsInvalid = false
          if (!!check.invalidated !== !!currentSelectionsInvalid) {
            _validationsChanged = true
          }
          // callback
          invalidateCheckCallback && invalidateCheckCallback(check, currentSelectionsInvalid)
        }
      }
    }
  }
  return _validationsChanged
};

/**
 * do callback if invalidated state has changed for this chekc
 * @param {object} check - check to verify if changed
 * @param {boolean} currentSelectionsInvalid - new invalidated state
 * @param {boolean} _selectionsChanged - running flag for any invalidation change
 * @param {function} invalidateCheckCallback - callback function
 * @returns {Promise<boolean>}
 */
function checkIfInvalidationChanged(check, currentSelectionsInvalid, _selectionsChanged, invalidateCheckCallback) {
  if (!!check.invalidated !== currentSelectionsInvalid) {
    _selectionsChanged = true
    // callback
    invalidateCheckCallback && invalidateCheckCallback(check, currentSelectionsInvalid)
  }
  return _selectionsChanged
}

/**
 * verify all selections
 * @param {Object} targetBible - target bible
 * @param {Object} groupsData - all the checks keyed by catagory
 * @param {Function} invalidateCheckCallback
 * @return {Promise<boolean>}
 */
export function validateSelectionsForAllChecks(targetBible, groupsData = null, invalidateCheckCallback = null)  {
  let _selectionsChanged = false;
  const filteredVerses = {} // for caching verse content parsed to text

  const groupIds = Object.keys(groupsData)
  for (const groupId of groupIds) {
    const checks = groupsData[groupId]

    for (let j = 0, lenGI = checks.length; j < lenGI; j++) {
      const check = checks[j];
      const selections = check.selections;
      const reference = check.contextId?.reference
      const chapter = reference.chapter
      const verse = reference.verse
      const ref = `${chapter}:${verse}`

      let targetVerse = filteredVerses[ref]
      if (!targetVerse) {
        targetVerse = getVerseText(targetBible, check.contextId, false)
        targetVerse = usfm.removeMarker(targetVerse) // remove USFM markers
        filteredVerses[ref] = targetVerse
      }

      if (targetVerse) {
        if (selections && selections.length) {
          const { selectionsChanged: currentSelectionsInvalid } = _validateVerseSelections(targetVerse, selections)
          _selectionsChanged = checkIfInvalidationChanged(check, currentSelectionsInvalid, _selectionsChanged, invalidateCheckCallback)
        } else { // no selections, so not invalid
          const currentSelectionsInvalid = false
          _selectionsChanged = checkIfInvalidationChanged(check, currentSelectionsInvalid, _selectionsChanged, invalidateCheckCallback)
        }
      }
    }
  }

  return _selectionsChanged
}
