import { peopleLists } from './people'
import { buySideLists } from './buySide'
import { sellSideLists } from './sellSide'
import { moneyLists } from './money'
import { OAuthApp } from './OAuthApp'
import { OAuthToken } from './OAuthToken'

export const models = {
  ...peopleLists,
  ...buySideLists,
  ...sellSideLists,
  ...moneyLists,
  OAuthApp,
  OAuthToken,
}

export default models
