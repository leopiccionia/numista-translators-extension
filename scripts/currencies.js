const i18n = getI18n()

const CURRENCIES_TEMPLATE = `
<button class="secondary" id="numista-translators-modal__dismiss" title="${i18n.getMessage('action_dismiss_modal')}">&times;</button>
<form id="numista-translators-modal__form">
	<label>
		<span>${i18n.getMessage('label_find')}</span>
		<input type="text" name="pattern" id="numista-translators-modal__pattern" placeholder="Pound">
	</label>
	<label>
		<span>${i18n.getMessage('label_replace')}</span>
		<input type="text" name="replacement" id="numista-translators-modal__template" placeholder="${i18n.getMessage('placeholder_replace_currencies')}">
	</label>
	<label>
		<span>${i18n.getMessage('label_field')}</span>
		<select name="field" id="numista-translators-modal__field">
			<option value="titre-" selected>${i18n.getMessage('field_title')}</option>
			<option value="equivalence-">${i18n.getMessage('field_subdivisions')}</option>
		</select>
	</label>
	<label id="numista-translators-modal__use-original-wrapper">
		<input type="checkbox" name="use-original" id="numista-translators-modal__use-original">
		<span>${i18n.getMessage('label_use_original')}</span>
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
	const regexpString = RegExp.escape(pattern)
	return new RegExp(String.raw`^${regexpString} \((.*)\)$`)
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
	if (field === 'equivalence-') {
		return 8
	} else {
		return 2
	}
}

function validatePatterns (find, replace) {
	if (!find) {
		alert(i18n.getMessage('error_empty_find'))
		return false
	}

	if (!replace) {
		alert(i18n.getMessage('error_empty_replace'))
		return false
	}

	return true
}


class CurrenciesModal {
	useOriginal = false
	currentIndex = 0
	field = 'titre-'
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
			this.displayUseOriginal(this.field === 'titre-')
		})

		this.addListener(this.query('form'), 'submit', (event) => {
			event.preventDefault()
		})

		this.addListener(this.query('replace'), 'click', async () => {
			await this.fillInput()
			this.fetchNextTranslation()
		})

		this.addListener(this.query('search'), 'click', () => {
			this.search()
		})

		this.addListener(this.query('skip'), 'click', () => {
			this.fetchNextTranslation()
		})

		this.addListener(this.query('use-original'), 'change', () => {
			this.useOriginal = !this.useOriginal
		})
	}

	createModal () {
		const modal = document.createElement('div')
		modal.id = 'numista-translators-modal'
		modal.innerHTML = CURRENCIES_TEMPLATE
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

	displayPreviewer (visible = true) {
		this.query('previewer').style.display = visible ? '' : 'none'
	}

	displayUseOriginal (visible = true) {
		this.query('use-original-wrapper').style.display = visible ? '' : 'none'
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
		return new Promise((resolve) => {
			const currentTranslation = this.currentTranslation

			const translatedField = this.query('translated')
			const destinationField = currentTranslation.querySelector(`textarea.translation[data-column="${this.field}"]`)

			destinationField.focus()
			destinationField.value = translatedField.value.trim()
			destinationField.blur()
			destinationField.dispatchEvent(new Event('focusout', { bubbles: true }))

			if (this.useOriginal && this.field === 'titre-') {
				setTimeout(() => {
					const alternateField = currentTranslation.querySelector('textarea.translation[data-column="alternative_names-"]')

					alternateField.focus()
					alternateField.value = this.pattern
					alternateField.blur()
					alternateField.dispatchEvent(new Event('focusout', { bubbles: true }))
					resolve()
				}, 250)
			} else {
				resolve()
			}
		})

	}

	fillTranslationForm () {
		this.setMessage(i18n.getMessage('results', [this.currentIndex + 1, this.filteredTranslations.length]))

		const originalField = this.query('original')
		const translationField = this.query('translated')

		const currentTranslation = this.currentTranslation

		const sourceField = currentTranslation.querySelector(`div.origin:nth-child(${getSourceIndex(this.field)})`)
		const sourceText = sourceField.textContent

		if (sourceText === this.pattern) {
			originalField.value = this.pattern
			translationField.value = this.template
		} else {
			const matches = sourceText.match(this.patternRegexp)
			if (matches?.[1]) {
				originalField.value = `${this.pattern} (${matches[1]})`
				translationField.value = `${this.template} (${matches[1]})`
			}
		}

		currentTranslation.scrollIntoView({ block: 'center' })
	}

	filterTranslations () {
		const sourceSelector = `div.origin:nth-child(${getSourceIndex(this.field)})`
		const translationSelector = `textarea.translation[data-column="${this.field}"]`

		if (this.field === 'equivalence-') {
			return this.translations.filter((translation) => {
				const sourceField = translation.querySelector(sourceSelector)
				const translationField = translation.querySelector(translationSelector)
				return (!translationField.textContent && sourceField.textContent === this.pattern)
			})
		} else {
			return this.translations.filter((translation) => {
				const sourceField = translation.querySelector(sourceSelector)
				const sourceText = sourceField.textContent
				const translationField = translation.querySelector(translationSelector)
				return (!translationField.textContent && (sourceText === this.pattern || this.patternRegexp.test(sourceText)))
			})
		}

	}

	hideTranslationForm () {
		this.currentIndex = 0
		this.filteredTranslations = []
		this.displayPreviewer(false)
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
			this.displayPreviewer(true)

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

const currenciesModal = new CurrenciesModal()
currenciesModal.init()
