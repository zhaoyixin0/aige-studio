import { test, expect } from '@playwright/test';
import { openLanding } from '../helpers/flows';

test.describe('Landing page', () => {
  test('renders title, input, and suggestion chips', async ({ page }) => {
    await openLanding(page);

    // Title heading
    await expect(page.getByRole('heading', { name: 'AIGE Studio', level: 1 })).toBeVisible();

    // Subtitle
    await expect(page.getByText('描述你想做的游戏，AI 帮你创建')).toBeVisible();

    // Input textarea
    const textarea = page.getByPlaceholder('描述你想做的游戏...');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEditable();

    // Featured expert chip OR Browse button — at least one chip-like element should exist
    const browseButton = page.getByRole('button', { name: /浏览全部专家模板/ });
    await expect(browseButton).toBeVisible();
  });

  test('textarea accepts input and updates value', async ({ page }) => {
    await openLanding(page);

    const textarea = page.getByPlaceholder('描述你想做的游戏...');
    await textarea.fill('一个测试游戏');
    await expect(textarea).toHaveValue('一个测试游戏');
  });
});
