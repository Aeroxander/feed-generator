import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as whatsAlf from './whats-alf'
import * as tokenHourly from './token-hourly'
import * as tokenDaily from './token-daily'
import * as tokenWeekly from './token-weekly'
import * as tokenMonthly from './token-monthly'
import * as tokenRanked from './token-ranked'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [whatsAlf.shortname]: whatsAlf.handler,
  [tokenHourly.shortname]: tokenHourly.handler,
  [tokenDaily.shortname]: tokenDaily.handler,
  [tokenWeekly.shortname]: tokenWeekly.handler,
  [tokenMonthly.shortname]: tokenMonthly.handler,
  [tokenRanked.shortname]: tokenRanked.handler,
}

export default algos

