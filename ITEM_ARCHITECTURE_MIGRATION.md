# Item Management 架构迁移设计

> 目标：取消 `store_menu_items.catalog_item_id = null` 这个"本地商品逃生舱"，统一以 `catalog_items` 作为唯一商品来源，通过 `scope` + `visible_store_ids` 控制可见性。对齐 Square / Toast 的主流模型。

---

## 一、总体目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 商品来源 | catalog_items + store_menu_items(local) 双表 | 仅 catalog_items 一张表 |
| 子店新增商品 | 直接写 store_menu_items | 走"商品申请"工单 → 主店建 store-exclusive |
| 商品可见性 | 隐式（本地商品仅本店可见） | 显式 scope + visible_store_ids |
| itemId 歧义 | POS/Order 不知道查哪张表 | 全局统一指向 catalog_items.id |
| 本地商品配置完整度 | 二等公民（无 modifier option / tax / multi-menu / combo） | 一等公民，与品牌商品共用所有能力 |

---

## 二、数据库 Schema 变更

### 2.1 catalog_items 新增字段

```prisma
model catalog_items {
  id              String   @id @default(uuid())
  brand_id        String
  name            String
  // ... 现有字段

  // ─── 新增 ───
  scope           CatalogItemScope @default(BRAND)
  owner_store_id  String?  // scope = STORE_EXCLUSIVE 时必填
  // 可见性：见 2.2
}

enum CatalogItemScope {
  BRAND            // 品牌商品，全品牌门店默认可见
  STORE_EXCLUSIVE  // 店铺专属商品，仅 visible 列表内的门店可见
}
```

约束：
- `scope = BRAND` 时 `owner_store_id` 必须为 NULL
- `scope = STORE_EXCLUSIVE` 时 `owner_store_id` 必填
- 添加 CHECK 约束或在 Service 层守护

索引：
```sql
CREATE INDEX idx_catalog_items_brand_scope ON catalog_items(brand_id, scope);
CREATE INDEX idx_catalog_items_owner_store ON catalog_items(owner_store_id) WHERE owner_store_id IS NOT NULL;
```

### 2.2 新增可见性关联表

```prisma
model catalog_item_visible_stores {
  catalog_item_id String
  store_id        String
  created_at      DateTime @default(now())

  catalog_item    catalog_items @relation(fields: [catalog_item_id], references: [id], onDelete: Cascade)

  @@id([catalog_item_id, store_id])
  @@index([store_id])
}
```

可见性规则（getStoreMenu 时）：
```
visible(item, storeId) =
  item.scope == BRAND
  OR (item.scope == STORE_EXCLUSIVE AND
      (item.owner_store_id == storeId
       OR EXISTS catalog_item_visible_stores(item.id, storeId)))
```

> 设计选择：单独表而非 JSON 数组字段，便于按 store_id 反查（"这家店能看到哪些专属商品"）。

### 2.3 store_menu_items 收紧

```prisma
model store_menu_items {
  // catalog_item_id 改为非空
  catalog_item_id String   // ❌ 不再允许 null

  // 删除以下字段（迁移到 catalog_items）
  // local_name
  // local_description
  // local_image_url
  // local_base_price
  // local_cost
  // local_category_id
}
```

迁移完成后，store_menu_items 回归"纯 overlay"职责：仅存放门店级覆盖（价格、可用性、名称、描述、图片、渠道可见性）。

### 2.4 顺手清理（可选，独立 PR）

- 合并 `store_item_channels` 与 `store_item_channel_config` → 保留 `store_item_channels`

---

## 三、数据迁移脚本

```sql
BEGIN;

-- Step 1: catalog_items 加字段（默认 BRAND）
ALTER TABLE catalog_items
  ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'BRAND',
  ADD COLUMN owner_store_id UUID NULL;

-- Step 2: 创建可见性表
CREATE TABLE catalog_item_visible_stores (
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (catalog_item_id, store_id)
);
CREATE INDEX idx_civs_store ON catalog_item_visible_stores(store_id);

-- Step 3: 把每条本地商品迁移成 catalog_items 中的 STORE_EXCLUSIVE
WITH migrated AS (
  INSERT INTO catalog_items (
    id, brand_id, name, description, image_url, base_price, cost,
    category_id, is_active, scope, owner_store_id, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    s.brand_id,           -- 通过 store→brand 反查（JOIN stores 表）
    smi.local_name,
    smi.local_description,
    smi.local_image_url,
    smi.local_base_price,
    smi.local_cost,
    smi.local_category_id,
    smi.is_available,
    'STORE_EXCLUSIVE',
    smi.store_id,
    smi.created_at,
    smi.updated_at
  FROM store_menu_items smi
  JOIN stores s ON s.id = smi.store_id
  WHERE smi.catalog_item_id IS NULL
  RETURNING id, owner_store_id
)
-- Step 4: 把对应 store_menu_items 行 catalog_item_id 回填（变成 overlay）
-- 注意：由于本地商品的 overlay 信息已经迁到 catalog_items，
--       原来的 store_menu_items 行可以直接删除
DELETE FROM store_menu_items WHERE catalog_item_id IS NULL;

-- Step 5: 迁移已有的 modifier_groups 关联（catalog_item_modifier_groups.store_menu_item_id → item_id）
UPDATE catalog_item_modifier_groups cimg
SET item_id = ci.id, store_menu_item_id = NULL
FROM catalog_items ci
WHERE cimg.store_menu_item_id IS NOT NULL
  AND ci.scope = 'STORE_EXCLUSIVE'
  AND ci.owner_store_id = (SELECT store_id FROM store_menu_items WHERE id = cimg.store_menu_item_id);

-- Step 6: 收紧 catalog_item_id 非空
ALTER TABLE store_menu_items ALTER COLUMN catalog_item_id SET NOT NULL;

-- Step 7: 删除 store_menu_items 中的 local_* 字段
ALTER TABLE store_menu_items
  DROP COLUMN local_name,
  DROP COLUMN local_description,
  DROP COLUMN local_image_url,
  DROP COLUMN local_base_price,
  DROP COLUMN local_cost,
  DROP COLUMN local_category_id;

COMMIT;
```

> ⚠️ 上线前必须在 staging 跑一次，验证：
> 1. 本地商品迁移后能在原门店正常显示
> 2. 修饰符关联未丢失
> 3. 价格、税率、可见性一致

---

## 四、API 变更清单

### 4.1 新增 / 修改

#### `POST /api/item-manage/v1/catalog-items` （主店）
扩展请求体：
```ts
{
  name, description, basePrice, ...,
  scope: 'BRAND' | 'STORE_EXCLUSIVE',     // 新增
  ownerStoreId?: string,                   // scope=STORE_EXCLUSIVE 时必填
  visibleStoreIds?: string[]               // 默认 = [ownerStoreId]
}
```

权限：
- 仅 MAIN 角色可调用
- `scope=BRAND` 必须 MAIN
- `scope=STORE_EXCLUSIVE` 也必须 MAIN（子店通过工单触发）

#### `PUT /api/item-manage/v1/catalog-items/:id/visibility` （主店）
```ts
{ visibleStoreIds: string[] }
```
覆盖可见性列表。

#### `GET /api/item-manage/v1/store-menu` （子店/POS）
内部查询调整为：
```sql
SELECT * FROM catalog_items ci
WHERE ci.brand_id = :brand_id
  AND (
    ci.scope = 'BRAND'
    OR ci.owner_store_id = :store_id
    OR EXISTS (SELECT 1 FROM catalog_item_visible_stores WHERE catalog_item_id = ci.id AND store_id = :store_id)
  )
```
返回结构不变（前端透明）。

### 4.2 新增"商品申请"工单（可选，二期）

#### `POST /api/item-manage/v1/item-requests` （子店）
```ts
{ name, description, suggestedPrice, reason }
```
主店审批后调用 catalog-items 创建接口。

> 一期可以先不做工单系统，主店直接代建即可。

### 4.3 删除（下线）

| 接口 | 替代 |
|---|---|
| `POST /store-menu/local-items` | 子店改走工单；主店改走 `POST /catalog-items {scope: STORE_EXCLUSIVE}` |
| `PUT /store-menu/local-items/:id` | `PUT /catalog-items/:id` |
| `DELETE /store-menu/local-items/:id` | `PUT /catalog-items/:id { isActive: false }` 或调整 visibility |
| `GET /store-menu/local-items` | 已包含在 `GET /store-menu` 中 |

---

## 五、前端改造点

### 5.1 主店（MAIN）— MenuCenter

[src/pages/MenuCenter/index.tsx](src/pages/MenuCenter/index.tsx)

商品创建/编辑表单新增：
```tsx
<Form.Item name="scope" label="商品范围" initialValue="BRAND">
  <Radio.Group>
    <Radio value="BRAND">品牌商品（所有门店可见）</Radio>
    <Radio value="STORE_EXCLUSIVE">店铺专属</Radio>
  </Radio.Group>
</Form.Item>

{scope === 'STORE_EXCLUSIVE' && (
  <Form.Item name="visibleStoreIds" label="可见门店" rules={[{ required: true }]}>
    <Select mode="multiple" options={storeOptions} />
  </Form.Item>
)}
```

商品列表新增"范围"列：BRAND / STORE_EXCLUSIVE Tag + 可见门店数。

### 5.2 子店（BRANCH/FRANCHISE）— StoreMenuManager

[src/pages/MenuCenter/StoreMenuManager.tsx](src/pages/MenuCenter/StoreMenuManager.tsx)

- ❌ 删除"创建本地商品"按钮
- ❌ 删除本地商品创建/编辑 Modal
- ✅ 新增"申请新商品"按钮 → 简单工单表单（一期可以只是 mailto 或 console.log，二期接工单系统）
- ✅ 商品列表保留覆盖编辑能力（价格、可用性、名称、图片、修饰符价格覆盖）
- ✅ 区分"品牌商品"和"店铺专属"用 Tag 显示

### 5.3 ItemModifierConfigInput 简化

[src/pages/MenuCenter/components/ItemModifierConfigInput.tsx](src/pages/MenuCenter/components/ItemModifierConfigInput.tsx)

由于本地商品不再存在二等公民问题：
- 删除 `simpleMode` prop
- 所有商品都能配置完整的选项级配置（启用/禁用、默认、单选项价）

### 5.4 store-menu service

[src/services/store-menu.ts](src/services/store-menu.ts)

- 删除 `createLocalItem` / `updateLocalItem` / `deleteLocalItem` / `getLocalItems` 方法
- `getStoreMenu` 返回结构去掉 `localItems` 字段（合并到 `items`）
- 新增字段：`items[].scope` 和 `items[].isStoreExclusive`，前端 UI 可据此显示标签

---

## 六、跨服务影响

### 6.1 Order Service

✅ **零改动**。原本就只认 `catalogItemId`，现在所有商品都有 catalogItemId，歧义消失。

### 6.2 POS Frontend

[tymoe-pos-front-end](../tymoe-pos-front-end)

- 删除 LocalItem 相关代码分支
- 下单 payload 不再需要 `isLocalItem` 字段
- `GET /store-menu` 返回的 items 已统一，前端 list 渲染逻辑可去掉 union

### 6.3 Online Shop Frontend

[tymoe-mopai-onlionshop-frontend](../tymoe-mopai-onlionshop-frontend)

同 POS，简化 menu 渲染逻辑。

---

## 七、上线节奏

| 阶段 | 内容 | 风险 |
|---|---|---|
| **W1 - 双写准备** | DB 加字段（scope/owner_store_id/visible_stores 表），catalog-items 创建接口支持 scope，但旧 local-items 接口保留 | 低 |
| **W2 - 数据迁移** | 在维护窗口跑迁移脚本，验证现有本地商品全部正确出现在新模型下 | 中（需 staging 充分验证） |
| **W3 - 前端切换** | 主店表单加 scope/visibility，子店下线 LocalItem 入口，POS/Online Shop 切换接口 | 低 |
| **W4 - 清理** | 删除 store_menu_items.local_* 字段、删除 LocalItem Controller/Service/前端代码 | 低 |
| **W5（可选）** | 清理 store_item_channels 重复表 | 低 |

> 如果担心一次性迁移风险，可以在 W1 和 W2 之间加一个"灰度"阶段：先拉一个非核心门店做 dry-run。

---

## 八、风险与回滚

### 风险
1. **迁移脚本中 brand_id 反查错误** → 本地商品被挂到错误品牌下。
   - 缓解：脚本先做 dry-run + diff 对比报表
2. **修饰符关联迁移遗漏** → 本地商品迁移后看不到原本配置的修饰符。
   - 缓解：迁移前后跑一致性检查 SQL
3. **可见性规则错误** → 子店看到了不该看到的专属商品。
   - 缓解：单元测试 + 集成测试覆盖三种场景（BRAND / 自有 STORE_EXCLUSIVE / 他店 STORE_EXCLUSIVE）

### 回滚
- W1-W2：直接回滚 schema migration，新字段未被真正使用
- W3 之后：需要反向迁移脚本（把 STORE_EXCLUSIVE 重新拆回 store_menu_items.local_*）
- 建议在 W2 完成后做一次完整 DB 备份，回滚直接还原

---

## 九、后续可叠加的改进

迁移完成后，下列改进会变得简单很多：

1. **领域事件** — catalog_items 是单一来源，发布 `ItemCreated/ItemUpdated/ItemPriceChanged` 给下游
2. **审计日志** — 只需要监听 catalog_items / store_menu_items / catalog_item_visible_stores 三张表
3. **商品申请工单系统** — 子店 → 主店 → 自动创建 STORE_EXCLUSIVE
4. **跨品牌商品复制** — 加一个 `cloneFromCatalogItemId` 字段即可
5. **Item 级库存** — 在 catalog_items 上挂 stock 字段或新增 item_stock 表

---

## 十、TL;DR

- **加 2 个字段 + 1 张表**（catalog_items.scope, catalog_items.owner_store_id, catalog_item_visible_stores）
- **删 1 张表的若干字段 + 一整套 LocalItem API/前端**
- **跑一次数据迁移**
- **整体是做减法**，长期维护成本下降，同时根除 itemId 歧义和本地商品二等公民两大缺陷
- **对齐 Square/Toast 主流模型**，未来对接 ERP/招人/扩展都更顺
