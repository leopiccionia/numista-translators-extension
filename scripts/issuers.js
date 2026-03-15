const i18n = getI18n()

const ISSUERS_TEMPLATE = `
<button class="secondary" id="numista-translators-modal__dismiss" title="${i18n.getMessage('action_dismiss_modal')}">&times;</button>
<form id="numista-translators-modal__form">
	<label>
		<span>${i18n.getMessage('label_find')}</span>
		<input type="text" name="pattern" id="numista-translators-modal__pattern" placeholder="#, City of">
	</label>
	<label>
		<span>${i18n.getMessage('label_replace')}</span>
		<input type="text" name="replacement" id="numista-translators-modal__template" placeholder="${i18n.getMessage('placeholder_replace')}">
	</label>
	<label>
		<span>${i18n.getMessage('label_field')}</span>
		<select name="field" id="numista-translators-modal__field">
			<option value="" selected>${i18n.getMessage('field_name')}</option>
			<option value="de_">${i18n.getMessage('field_from')}</option>
		</select>
	</label>
	<button id="numista-translators-modal__search" type="button">${i18n.getMessage('action_search')}</button>
	<div id="numista-translators-modal__previewer" style="display: none">
		<p id="numista-translators-modal__message">${i18n.getMessage('loading')}</p>
		<label>
			<span>${i18n.getMessage('label_original')}</span>
			<input type="text" readonly name="original" id="numista-translators-modal__original">
		</label>
		<label>
			<span>${i18n.getMessage('label_translated')}</span>
			<input type="text" name="translated" id="numista-translators-modal__translated">
		</label>
		<div class="numista-translators-modal__buttons">
			<button id="numista-translators-modal__skip" type="button" class="secondary">${i18n.getMessage('action_skip')}</button>
			<button id="numista-translators-modal__replace" type="button">${i18n.getMessage('action_replace')}</button>
		</div>
	</div>
</form>
`

function buildRegexpFromPattern (pattern) {
	const placeholder = String.raw`\x23` // escaped '#'
	const regexpString = RegExp.escape(pattern).replace(placeholder, '(.*)')
	return new RegExp(`^${regexpString}$`)
}

function countPlaceholders (pattern) {
	let count = 0
	for (const char of pattern) {
		if (char === '#') {
			count++
		}
	}
	return count
}

function getI18n () {
	if (typeof browser !== 'undefined' && browser.i18n) {
		return browser.i18n
	}
	if (typeof chrome !== 'undefined' && chrome.i18n) {
		return chrome.i18n
	}
	return {
		getMessage: (message) => message,
	}
}

function getSourceIndex (field) {
	if (field === 'de_') {
		return 4
	} else {
		return 2
	}
}

function validatePatterns (find, replace) {
	if (!find) {
		alert(i18n.getMessage(i18n.getMessage('error_empty_find')))
		return false
	}

	if (!replace) {
		alert(i18n.getMessage(i18n.getMessage('error_empty_replace')))
		return false
	}

	const findPlaceholders = countPlaceholders(find)
	const replacePlaceholders = countPlaceholders(replace)

	if (findPlaceholders !== replacePlaceholders) {
		alert(i18n.getMessage('error_mismatch_placeholders', [findPlaceholders, replacePlaceholders]))
		return false
	}

	if (findPlaceholders > 1) {
		alert(i18n.getMessage(i18n.getMessage('error_too_many_placeholders')))
		return false
	}

	return true
}

class IssuersModal {
	currentIndex = 0
	field = ''
	filteredTranslations = []
	listeners = []
	pattern = ''
	patternRegexp = null
	template = ''
	translations = []

	addListener (el, event, callback) {
		el.addEventListener(event, callback)
		this.listeners.push([el, event, callback])
	}

	addListeners () {
		this.addListener(this.query('dismiss'), 'click', () => {
			this.dismissModal()
		})

		this.addListener(this.query('field'), 'change', (event) => {
			this.field = event.target.value
		})

		this.addListener(this.query('form'), 'submit', (event) => {
			event.preventDefault()
		})

		this.addListener(this.query('replace'), 'click', () => {
			this.fillInput()
			this.fetchNextTranslation()
		})

		this.addListener(this.query('search'), 'click', () => {
			this.search()
		})

		this.addListener(this.query('skip'), 'click', () => {
			this.fetchNextTranslation()
		})
	}

	createModal () {
		const modal = document.createElement('div')
		modal.id = 'numista-translators-modal'
		modal.innerHTML = ISSUERS_TEMPLATE
		document.body.appendChild(modal)

		setTimeout(() => {
			this.addListeners()
		}, 0)

		return modal
	}

	get currentTranslation () {
		return this.filteredTranslations[this.currentIndex]
	}

	dismissModal () {
		this.modal.remove()
		this.removeListeners()

		this.filteredTranslations = []
		this.modal = null
		this.patternRegexp = null
		this.translations = []
	}

	displayPreviewer (display = '') {
		this.query('previewer').style.display = display
	}

	fetchNextTranslation () {
		if (this.currentIndex === this.filteredTranslations.length - 1) {
			this.hideTranslationForm()
		} else {
			this.currentIndex++
			this.fillTranslationForm()
		}
	}

	fillInput () {
		const translatedField = this.query('translated')
		const destinationField = this.currentTranslation.querySelector(`textarea.translation[data-column="${this.field}"]`)

		destinationField.focus()
		destinationField.value = translatedField.value.trim()
		destinationField.blur()
		destinationField.dispatchEvent(new Event('focusout', { bubbles: true }))
	}

	fillTranslationForm () {
		this.setMessage(i18n.getMessage('results', [this.currentIndex + 1, this.filteredTranslations.length]))

		const originalField = this.query('original')
		const translationField = this.query('translated')

		const currentTranslation = this.currentTranslation

		const sourceField = currentTranslation.querySelector(`div.origin:nth-child(${getSourceIndex(this.field)})`)
		const matches = sourceField.textContent.match(this.patternRegexp)

		if (matches?.[1]) {
			originalField.value = this.pattern.replace('#', matches[1])
			translationField.value = this.template.replace('#', matches[1])
		} else {
			originalField.value = this.pattern
			translationField.value = this.template
		}

		currentTranslation.scrollIntoView({ block: 'center' })
	}

	filterTranslations () {
		const sourceSelector = `div.origin:nth-child(${getSourceIndex(this.field)})`
		const translationSelector = `textarea.translation[data-column="${this.field}"]`

		return this.translations.filter((translation) => {
			const sourceField = translation.querySelector(sourceSelector)
			const translationField = translation.querySelector(translationSelector)
			return (!translationField.textContent && this.patternRegexp.test(sourceField.textContent))
		})
	}

	hideTranslationForm () {
		this.currentIndex = 0
		this.filteredTranslations = []
		this.displayPreviewer('none')
	}

	init () {
		this.modal = this.createModal()
		this.translations = this.queryAllTranslations()
	}

	query (selector) {
		return this.modal.querySelector(`#numista-translators-modal__${selector}`)
	}

	queryAllTranslations () {
		return Array.from(document.querySelectorAll('.interface_translation'))
	}

	removeListeners () {
		for (const [el, event, callback] of this.listeners) {
			el.removeEventListener(event, callback)
		}
		this.listeners = []
	}

	search () {
		this.pattern = this.query('pattern').value.trim()
		this.template = this.query('template').value.trim()

		if (validatePatterns(this.pattern, this.template)) {
			this.setMessage(i18n.getMessage('loading'))
			this.displayPreviewer()

			this.patternRegexp = buildRegexpFromPattern(this.pattern)
			this.filteredTranslations = this.filterTranslations()

			if (this.filteredTranslations.length > 0) {
				this.currentIndex = 0
				this.fillTranslationForm()
			} else {
				this.hideTranslationForm()
			}
		} else {
			this.hideTranslationForm()
		}
	}

	setMessage (message) {
		this.query('message').textContent = message
	}
}

const issuersModal = new IssuersModal()
issuersModal.init()
