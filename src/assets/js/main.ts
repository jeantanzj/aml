const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9]/g, '')
const addNewSection = (
  source: string,
  listname: string,
  timestamp?: string
): HTMLElement => {
  const anchorName = sanitize(listname)
  const sectionContent = `
    <div class="container">
        <h1 class="title">
            <a id="${anchorName}"></a>
            <a href="${source}" target="_blank">${listname}</a>
            <span class="has-text-weight-normal is-size-7">(jump to <a href="#${anchorName}-entities">entities</a>) </span>
            <span class="has-text-weight-light is-size-7">Last refreshed ${
              (timestamp && new Date(timestamp)) || 'unknown'
            }</span>
        </h1>
        <div class="individuals">

            <a id="${anchorName}-individuals"></a>
            <h2 class="subtitle">
                Individuals
            </h2>
            <div class="tile is-ancestor">
                <div class="tile is-parent is-vertical">
                   
                </div>
            </div>
        </div>
        <div class="entities">
            <a id="${anchorName}-entities"></a>
            <h2 class="subtitle">
                Entities
            </h2>
            <div class="tile is-ancestor">
                <div class="tile is-parent is-vertical">
                   
                </div>
            </div>
        </div>
        <p class="has-text-weight-normal has-text-right"><a href="#top">back to top</a> / <a href="#${anchorName}">of ${listname}</a> </p>
    </div>`
  const section = document.createElement('section')
  section.className = 'section'
  section.innerHTML = sectionContent
  document.getElementById('app')?.appendChild(section)
  return section
}

const addToSection = (
  section: HTMLElement,
  part: string,
  property: {
    error?: string
    names?: string[]
    comments?: string[]
    listed_on?: string
    reference?: string
    designation?: string
  }
) => {
  const propertyContent = property.error
    ? `<div class="tile is-child"> An error occurred </div>`
    : `<div class="tile is-child">
    <p class="has-text-weight-bold">${
      property.reference !== undefined ? '[' + property.reference + ']' : ''
    } ${property.names?.join(' ')}</p>
    <p class="has-text-weight-normal">${
      property.designation !== undefined ? property.designation + '<br>' : ''
    }${property.comments?.join(' ')}</p>
    <p class="has-text-weight-light has-text-right is-size-7">Listed on ${
      property.listed_on
    }</p>
    </div>`
  const tile = document.createElement('div')
  tile.className = 'tile is-child'
  tile.innerHTML = propertyContent
  section.querySelector(`.${part} .is-parent`)?.appendChild(tile)
  return section
}

const addFirstSchedule = (
  source: string,
  listname: string,
  data: string,
  timestamp?: string
) => {
  const anchorName = sanitize(listname)
  const sectionContent = `
     <div class="container">
        <h1 class="title">
            <a id="${anchorName}"></a>
            <a href="${source}" target="_blank">${listname}</a>
            <span class="has-text-weight-light is-size-7">Last refreshed ${
              (timestamp && new Date(timestamp)) || 'unknown'
            }</span>
        </h1>
         <div>
         ${data}
         </div>
         <p class="has-text-weight-normal has-text-right"><a href="#top">back to top</a> / <a href="#${anchorName}">of ${listname}</a> </p>
     </div>`
  const section = document.createElement('section')
  section.className = 'section'
  section.innerHTML = sectionContent
  document.getElementById('app')?.appendChild(section)
  return section
}
const updateProgressBar = (current: number, max: number) => {
  const el = document.getElementById('listname')
  if (el) el.innerText = `${current}/${max}`
}
const updateTableOfContents = (listnames: string[]) => {
  document.getElementById('progress-bar')?.classList.add('is-hidden')
  const tableContent = (listname: string) =>
    `<li><a href="#${sanitize(listname)}">${listname}</a></li>`
  const table = document.createElement('ul')
  table.innerHTML = listnames.map(tableContent).join('')
  document.getElementById('table-of-contents')?.appendChild(table)
}

const onLoaded = async () => {
  const sanctions = await fetch('/lists').then(async (response) => {
    return response.json()
  })
  const numLists = Object.keys(sanctions).length + 1
  let doneSoFar = 0
  await Promise.all(
    Object.keys(sanctions).map((listname) => {
      return fetch(`/list/${listname}`)
        .then(async (response) => {
          if (response.status !== 200) {
            const section = addNewSection(sanctions[listname], listname)
            addToSection(section, 'individuals', { error: 'An error occurred' })
            return
          }
          const {
            source,
            list_name,
            timestamp,
            individuals,
            entities,
          } = await response.json()
          const section = addNewSection(source, list_name, timestamp)
          individuals?.forEach((i: any) =>
            addToSection(section, 'individuals', i)
          )
          entities?.forEach((i: any) => addToSection(section, 'entities', i))
        })
        .catch((err) => {
          console.error(err)
        })
        .finally(() => {
          doneSoFar++
          updateProgressBar(doneSoFar, numLists)
        })
    })
  )
  const { source, list_name: firstschedule, timestamp, data } = await fetch(
    '/first-schedule'
  ).then((response) => response.json())
  doneSoFar++
  updateProgressBar(doneSoFar, numLists)
  addFirstSchedule(source, firstschedule, data, timestamp)
  updateTableOfContents(Object.keys(sanctions).concat(firstschedule))
}

document.addEventListener('DOMContentLoaded', onLoaded)
