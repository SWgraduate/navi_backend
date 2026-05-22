import {
  Controller,
  Get,
  Query,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { CampusLifeService } from 'src/services/CampusLifeService';
import { ICafeteriaMenu } from 'src/models/CafeteriaMenu';

export interface MenuResponse {
  cafeteriaId: string;
  cafeteriaName: string;
  date: string;
  meals: {
    time: string;
    menus: {
      name: string;
      price: string;
      imageUrl?: string;
    }[];
  }[];
}

@Route('campus-life')
@Tags('CampusLife')
export class CampusLifeController extends Controller {
  private campusLifeService = CampusLifeService.getInstance();

  /**
   * 특정 날짜의 구내식당 메뉴를 반환합니다.
   * DB에 캐시된 데이터가 없으면 한양대 웹에서 크롤링 후 저장합니다.
   *
   * @param cafeteriaId 식당 ID (re11: 교직원식당, re12: 학생식당, re13: 창의인재원, re14: 푸드코트, re15: 창업보육센터)
   */
  @Get('menu')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(404, 'Menu not found')
  @Response<{ error: string }>(500, 'Internal Server Error')
  public async getMenu(
    @Query() cafeteriaId: string = 're12',
  ): Promise<MenuResponse | { error: string }> {
    try {
      const menu: ICafeteriaMenu | null = await this.campusLifeService.getTodayMenu(cafeteriaId);

      if (!menu) {
        this.setStatus(404);
        return { error: '오늘의 메뉴 정보가 없습니다. 주말이거나 아직 메뉴가 등록되지 않았습니다.' };
      }

      return {
        cafeteriaId: menu.cafeteriaId,
        cafeteriaName: menu.cafeteriaName,
        date: menu.date,
        meals: menu.meals.map(m => ({
          time: m.time,
          menus: m.menus.map(item => ({
            name: item.name,
            price: item.price,
            ...(item.imageUrl && { imageUrl: item.imageUrl }),
          })),
        })),
      };
    } catch (error) {
      this.setStatus(500);
      return { error: '메뉴 정보를 가져오는 데 실패했습니다.' };
    }
  }
}
