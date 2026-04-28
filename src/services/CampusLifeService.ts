import { logger } from 'src/utils/log';
import * as cheerio from 'cheerio';
import axios from 'axios';

export interface MealItem {
  name: string;
  price: string;
}

export interface DailyMeal {
  time: string; // e.g., "조식", "중식", "석식"
  menus: MealItem[];
}

export interface DailyCafeteriaMenu {
  cafeteriaName: string;
  date: string;
  meals: DailyMeal[];
}

export class CampusLifeService {
  /**
   * 학식 정보를 크롤링하여 가져옵니다.
   * @param date 조회할 날짜 (형식: YYYY-MM-DD, 기본값: 오늘)
   * @param cafeteriaId 식당 ID (re11: 교직원식당, re12: 학생식당, re13: 창의인재원, re14: 푸드코트, re15: 창업보육센터)
   */
  public async getMealInfo(date?: string, cafeteriaId: string = 're11'): Promise<DailyCafeteriaMenu> {
    logger.i(`CampusLifeService: 학식 정보 조회 요청 (date: ${date || '오늘'}, cafeteriaId: ${cafeteriaId})`);
    
    // YYYY-MM-DD 형식을 YYYY/MM/DD 형식으로 변환
    let targetDateStr = '';
    if (date) {
      targetDateStr = date.replace(/-/g, '%2F');
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      targetDateStr = `${yyyy}%2F${mm}%2F${dd}`;
    }

    const url = `https://www.hanyang.ac.kr/web/www/${cafeteriaId}?p_p_id=kr_ac_hanyang_cafe_web_portlet_CafePortlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_kr_ac_hanyang_cafe_web_portlet_CafePortlet_sMenuDate=${targetDateStr}&_kr_ac_hanyang_cafe_web_portlet_CafePortlet_action=view`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      const cafeteriaName = $('.hyu-cafeName').text().trim() || '교직원식당';
      const parsedDate = $('.hyu-pagination-item.next').prev('h1').text().trim() || date || '날짜 미상';

      const meals: DailyMeal[] = [];

      // dailyView 섹션 내의 각 식사 시간대(조식, 중식, 석식 등) 파싱
      // h3.hyu-element 요소가 식사 시간대를 나타냄
      $('#_kr_ac_hanyang_cafe_web_portlet_CafePortlet_dailyView > h3.hyu-element').each((i, elem) => {
        const time = $(elem).text().trim();
        const menus: MealItem[] = [];

        // 해당 h3 바로 다음의 hyu-list-container 를 찾음
        const listContainer = $(elem).next('.hyu-list-container');
        
        listContainer.find('.menu-thumbnail').each((j, menuElem) => {
          const name = $(menuElem).find('.menu-detail p').text().trim();
          const price = $(menuElem).find('.menu-price h3').text().trim();
          
          if (name) {
            menus.push({ name, price });
          }
        });

        if (menus.length > 0) {
          meals.push({ time, menus });
        }
      });

      return {
        cafeteriaName,
        date: parsedDate,
        meals
      };

    } catch (error) {
      logger.e('CampusLifeService: 학식 정보 크롤링 중 오류 발생', error);
      throw new Error('학식 정보를 가져오는 데 실패했습니다.');
    }
  }

  /**
   * 대학 생활 정보를 가져옵니다.
   */
  public async getCampusInfo() {
    // TODO: 구현 예정
    logger.i('CampusLifeService: 대학 생활 정보 조회 요청');
  }
}
