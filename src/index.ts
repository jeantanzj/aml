import express from 'express'
import axios from 'axios'
import xmljs from 'xml-js'
import _ from 'lodash'
import path from 'path'
const FIRST_SCHEDULE =
  'https://sso.agc.gov.sg/Details/GetLazyLoadContent?TocSysId=b971ee73-430a-441b-a871-f6e598493a84&SeriesId=aca9cde0-9458-4ae6-9826-2f68bbfa9d37&FragSysId=b031d2a3-514b-47ea-8d10-09d43dc9bcb3&_=20200522015918'
const SANCTIONS: { [param: string]: string } = {
  dprk: 'https://scsanctions.un.org/dprk',
  drc: 'https://scsanctions.un.org/drc',
  iran: 'https://scsanctions.un.org/iran',
  libya: 'https://scsanctions.un.org/libya',
  somalia: 'https://scsanctions.un.org/somalia',
  'south-sudan': 'https://scsanctions.un.org/south-sudan',
  sudan: 'https://scsanctions.un.org/sudan',
  yemen: 'https://scsanctions.un.org/yemen',
  'al-qaida': 'https://scsanctions.un.org/al-qaida',
  taliban: 'https://scsanctions.un.org/taliban',
}
const cache: { [param: string]: any } = {}

const getFirstSchedule = async (url: string) => {
  if (cache[url] && Date.now() - cache[url]['timestamp'] < 600000) {
    //cache for 10 minutes
    return cache[url]
  }
  const data = await axios.get(url).then(({ data }) => data)
  cache[url] = {
    data,
    timestamp: Date.now(),
  }
  return cache[url]
}
const getSanctionList = async (url: string) => {
  if (cache[url] && Date.now() - cache[url]['timestamp'] < 600000) {
    //cache for 10 minutes
    return cache[url]
  }
  const data = await axios
    .get(url, { headers: { Accept: 'application/xhtml+xml,application/xml' } })
    .then(({ data }) =>
      JSON.parse(xmljs.xml2json(data, { compact: true, spaces: 4 }))
    )
  cache[url] = {
    data,
    timestamp: Date.now(),
  }
  return cache[url]
}
const findName = (property: object | string, names: string[]) => {
  if (typeof property !== 'object') {
    return
  }
  for (const [key, entry] of Object.entries(property)) {
    if (key.indexOf('NAME') !== -1 && entry['_text']) {
      names.push(entry['_text'])
    } else {
      findName(entry, names)
    }
  }
  return
}
const parse = (property: { [param: string]: string }) => {
  const result = {
    designation: _.get(property, 'DESIGNATION.VALUE._text'),
    reference: _.get(property, 'REFERENCE_NUMBER._text'),
    listed_on: _.get(property, 'LISTED_ON._text'),
    comments: _.keys(property)
      .filter((key: string) => key.indexOf('COMMENT') !== -1)
      .map((key: string) => _.get(property, [key, '_text'])),
    names: [],
  }
  findName(property, result.names)
  return result
}

const port = Number(process.env.PORT) || 4000
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'assets')))
app.get('/lists', (_req, res) => res.json(SANCTIONS))
app.get('/list/:listname', async (req, res, next) => {
  try {
    const { listname } = req.params
    if (!(listname in SANCTIONS)) {
      return res.sendStatus(404)
    }
    const { data, timestamp } = await getSanctionList(SANCTIONS[listname])
    const result = {
      timestamp,
      list_name: listname,
      source: SANCTIONS[listname],
      individuals: []
        .concat(_.get(data, 'CONSOLIDATED_LIST.INDIVIDUALS.INDIVIDUAL'))
        .map(parse),
      entities: []
        .concat(_.get(data, 'CONSOLIDATED_LIST.ENTITIES.ENTITY'))
        .map(parse),
    }
    return res.json(result)
  } catch (err) {
    return next(err)
  }
})

app.get('/first-schedule', async (_req, res, next) => {
  try {
    const { data, timestamp } = await getFirstSchedule(FIRST_SCHEDULE)
    return res.json({
      source: FIRST_SCHEDULE,
      list_name: 'first-schedule',
      data,
      timestamp,
    })
  } catch (err) {
    return next(err)
  }
})

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err)
    return res.status(500).json(err)
  }
)
app.listen(port, () => console.log(`App listening at ${port}`))
