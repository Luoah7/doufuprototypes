/**
 * @name 豆腐工厂移动配货原型
 * @mode axure
 *
 * 参考资料：
 * - /rules/development-guide.md
 * - /rules/design-guide.md
 * - /src/prototypes/tofu-factory-ops/spec.md
 * - /src/themes/antd-new/DESIGN.md
 */

import './style.css';

import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from 'react';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    ClipboardPaste,
    Clock3,
    FileText,
    Home,
    Image,
    MapPin,
    Minus,
    Package,
    Phone,
    Plus,
    ReceiptText,
    Scale,
    ScanLine,
    Store,
    Truck,
} from 'lucide-react';

import type {
    Action,
    AxureHandle,
    AxureProps,
    ConfigItem,
    DataDesc,
    EventItem,
    KeyDesc,
} from '../../common/axure-types';
import { createEventEmitter, getConfigValue, getDataValue } from '../../common/axure-types';

type TaskStatus = '待复秤' | '待拍照' | '待送达' | '异常' | '已完成';
type MainTab = 'home' | 'tasks' | 'manage';
type TaskViewMode = 'delivery' | 'list';
type DeliveryViewFilter = '待配送' | '已完成';
type MerchantType = '超市' | '小商贩' | '散户';
type ManageView = 'merchant' | 'product' | 'addMerchant' | 'addProduct' | 'merchantDetail' | 'productDetail';

type LoginAccount = {
    username: string;
    password: string;
    displayName: string;
};

type ProductSpec = {
    id: string;
    label: string;
    unitPrice: number;
};

type ProductCatalog = {
    id: string;
    name: string;
    category: string;
    specs: ProductSpec[];
};

type TaskItem = {
    id: string;
    productId?: string;
    specId?: string;
    name: string;
    specLabel?: string;
    unitPrice: number;
    quantity: number;
    plannedWeight: number;
};

type HistoryItem = {
    name: string;
    specLabel: string;
    weight: number;
    unitPrice: number;
    subtotal: number;
};

type MerchantHistoryRecord = {
    id: string;
    date: string;
    label: string;
    totalAmount: number;
    status: '待结算' | '已结算';
    plannedWeight: number;
    actualWeight: number;
    sentBasket: number;
    returnedBasket: number;
    operator: string;
    note?: string;
    photoCount: number;
    items: HistoryItem[];
};

type MerchantProfile = {
    id: string;
    name: string;
    type: MerchantType;
    address: string;
    phone: string;
    settlementDay: string;
    discountRate: number;
    currentBasketCount: number;
    pendingAmount: number;
    settledAmount: number;
    note?: string;
    deliveryHistory: MerchantHistoryRecord[];
};

type DeliveryTask = {
    id: string;
    merchantId?: string;
    merchantName: string;
    merchantType: MerchantType;
    address: string;
    phone: string;
    routeEta: string;
    status: TaskStatus;
    settlementDay: string;
    plannedWeight: number;
    actualWeight: number;
    photoCount: number;
    beforeBasketCount: number;
    sentBasketCount: number;
    returnedBasketCount: number;
    signMethod: string;
    lastMessage: string;
    operator: string;
    note?: string;
    exceptionReason?: string;
    exceptionNote?: string;
    items: TaskItem[];
};

type ManualEntryLine = {
    id: string;
    productId: string;
    specId: string;
    quantity: number;
    plannedWeight: number;
};

const EVENT_LIST: EventItem[] = [
    { name: 'on_login_success', desc: '登录成功时触发', payload: '登录账号 JSON' },
    { name: 'on_task_selected', desc: '打开配货任务详情时触发', payload: '任务信息 JSON' },
    { name: 'on_tab_changed', desc: '切换底部标签时触发', payload: '标签信息 JSON' },
    { name: 'on_weight_confirmed', desc: '确认复秤时触发', payload: '复秤结果 JSON' },
    { name: 'on_photo_updated', desc: '更新照片数量时触发', payload: '照片信息 JSON' },
    { name: 'on_basket_changed', desc: '修改筐数量时触发', payload: '筐交接 JSON' },
    { name: 'on_delivery_completed', desc: '完成供货时触发', payload: '完成结果 JSON' },
    { name: 'on_data_entry_opened', desc: '打开数据录入入口时触发', payload: '录入方式 JSON' },
    { name: 'on_exception_recorded', desc: '记录异常时触发', payload: '异常记录 JSON' },
    { name: 'on_merchant_selected', desc: '切换商户管理对象时触发', payload: '商户信息 JSON' },
];

const ACTION_LIST: Action[] = [
    { name: 'switch_tab', desc: '切换标签页，参数：{ "tab": "home|tasks|manage" }' },
    { name: 'select_task', desc: '选择任务，参数：{ "id": "task_id" }' },
    { name: 'update_weight', desc: '更新复秤重量，参数：{ "id": "task_id", "actual_weight": 42.6 }' },
    { name: 'set_photo_count', desc: '更新照片数量，参数：{ "id": "task_id", "photo_count": 2 }' },
    { name: 'update_basket', desc: '更新筐交接，参数：{ "id": "task_id", "sent": 3, "returned": 2 }' },
    { name: 'open_data_entry', desc: '打开数据录入，参数：{ "mode": "manual|paste|ocr" }' },
    { name: 'complete_delivery', desc: '标记供货完成，参数：{ "id": "task_id" }' },
    { name: 'record_exception', desc: '记录异常，参数：{ "id": "task_id", "reason": "临时改量", "note": "客户临时少收" }' },
];

const VAR_LIST: KeyDesc[] = [
    { name: 'current_tab', desc: '当前标签页：home/tasks/manage' },
    { name: 'selected_task_id', desc: '当前选中的配货任务 ID' },
    { name: 'pending_photo_count', desc: '仍缺少复秤照片的任务数量' },
    { name: 'pending_basket_count', desc: '待回收筐总数' },
    { name: 'is_logged_in', desc: '当前是否已登录' },
    { name: 'task_view_mode', desc: '任务页视图：delivery/list' },
];

const CONFIG_LIST: ConfigItem[] = [
    { type: 'input', attributeId: 'factory_name', displayName: '工厂名称', info: '顶部展示的工厂名称', initialValue: '卢凡豆业' },
    { type: 'input', attributeId: 'operator_name', displayName: '当前操作人', info: '移动端默认操作人', initialValue: '老卢' },
    { type: 'input', attributeId: 'login_username', displayName: '登录账号', info: '后台手动配置的登录账号', initialValue: '13333563336' },
    { type: 'input', attributeId: 'login_password', displayName: '登录密码', info: '后台手动配置的登录密码', initialValue: '123456' },
    { type: 'input', attributeId: 'login_display_name', displayName: '登录用户名称', info: '登录页展示的账号名称', initialValue: '老卢' },
    { type: 'input', attributeId: 'current_date', displayName: '供货日期', info: '当前任务日期', initialValue: '2026-03-14' },
    { type: 'inputNumber', attributeId: 'weight_diff_threshold', displayName: '复秤差异阈值', info: '超过该值提示异常', initialValue: 0.5 },
    { type: 'checkbox', attributeId: 'show_bill_tab', displayName: '显示基础管理', info: '是否展示移动端基础管理入口', initialValue: true },
];

const DATA_LIST: DataDesc[] = [
    {
        name: 'tasks',
        desc: '今日配货任务列表',
        keys: [
            { name: 'id', desc: '任务 ID' },
            { name: 'merchant_name', desc: '商户名称' },
            { name: 'status', desc: '任务状态' },
            { name: 'planned_weight', desc: '应配重量' },
            { name: 'actual_weight', desc: '实际复秤重量' },
            { name: 'photo_count', desc: '照片数量' },
            { name: 'sent_basket_count', desc: '本次送出筐数' },
            { name: 'returned_basket_count', desc: '本次回收筐数' },
        ],
    },
    {
        name: 'merchants',
        desc: '商户基础管理数据',
        keys: [
            { name: 'id', desc: '商户 ID' },
            { name: 'name', desc: '商户名称' },
            { name: 'discount_rate', desc: '优惠倍率，例如 0.95' },
            { name: 'pending_amount', desc: '待结算金额' },
            { name: 'settled_amount', desc: '已结算金额' },
        ],
    },
    {
        name: 'products',
        desc: '商品与规格维护数据',
        keys: [
            { name: 'id', desc: '商品 ID' },
            { name: 'name', desc: '商品名称' },
            { name: 'specs', desc: '可选规格与单价列表' },
        ],
    },
];

const DEFAULT_PRODUCTS: ProductCatalog[] = [
    {
        id: 'prod_tofu',
        name: '豆腐',
        category: '豆腐类',
        specs: [
            { id: 'spec_tofu_2', label: '常规价 ¥2/斤', unitPrice: 2 },
            { id: 'spec_tofu_25', label: '精品价 ¥2.5/斤', unitPrice: 2.5 },
        ],
    },
    {
        id: 'prod_black_tofu',
        name: '黑豆腐',
        category: '豆腐类',
        specs: [
            { id: 'spec_black_tofu_4', label: '常规价 ¥4/斤', unitPrice: 4 },
        ],
    },
    {
        id: 'prod_dry_tofu',
        name: '豆干',
        category: '豆干类',
        specs: [
            { id: 'spec_seasoned_dry_6', label: '调味 ¥6/斤', unitPrice: 6 },
            { id: 'spec_plain_dry_5', label: '未调味 ¥5/斤', unitPrice: 5 },
        ],
    },
    {
        id: 'prod_crispy_tofu',
        name: '脆皮豆腐',
        category: '豆腐类',
        specs: [
            { id: 'spec_crispy_tofu_6', label: '常规价 ¥6/斤', unitPrice: 6 },
        ],
    },
];

const DEFAULT_MERCHANTS: MerchantProfile[] = [
    {
        id: 'merchant_dongqiao',
        name: '东桥生活超市',
        type: '超市',
        address: '东桥路 18 号后门冷柜区',
        phone: '13800002211',
        settlementDay: '每月 5 日',
        discountRate: 1,
        currentBasketCount: 9,
        pendingAmount: 786,
        settledAmount: 3280,
        deliveryHistory: [
            { id: 'hist_dongqiao_1', date: '03-14', label: '豆腐 / 黑豆腐 / 脆皮豆腐', totalAmount: 274, status: '待结算', plannedWeight: 42, actualWeight: 41.6, sentBasket: 3, returnedBasket: 2, operator: '老卢', photoCount: 1, note: '先送超市，再回收昨天留在后门的空筐', items: [{ name: '豆腐', specLabel: '精品价 ¥2.5/斤', weight: 20, unitPrice: 2.5, subtotal: 50 }, { name: '黑豆腐', specLabel: '常规价 ¥4/斤', weight: 10, unitPrice: 4, subtotal: 40 }, { name: '脆皮豆腐', specLabel: '常规价 ¥6/斤', weight: 12, unitPrice: 6, subtotal: 72 }] },
            { id: 'hist_dongqiao_2', date: '03-13', label: '豆腐 / 黑豆腐', totalAmount: 244, status: '待结算', plannedWeight: 38, actualWeight: 37.8, sentBasket: 2, returnedBasket: 3, operator: '老卢', photoCount: 1, items: [{ name: '豆腐', specLabel: '精品价 ¥2.5/斤', weight: 18, unitPrice: 2.5, subtotal: 45 }, { name: '黑豆腐', specLabel: '常规价 ¥4/斤', weight: 20, unitPrice: 4, subtotal: 80 }] },
            { id: 'hist_dongqiao_3', date: '02-28', label: '月末结算单', totalAmount: 1380, status: '已结算', plannedWeight: 0, actualWeight: 0, sentBasket: 0, returnedBasket: 0, operator: '老卢', photoCount: 0, items: [] },
        ],
    },
    {
        id: 'merchant_liuji',
        name: '刘记早餐摊',
        type: '小商贩',
        address: '城南早市 2 排 6 号',
        phone: '13900003322',
        settlementDay: '每周日',
        discountRate: 0.95,
        currentBasketCount: 4,
        pendingAmount: 312,
        settledAmount: 1688,
        deliveryHistory: [
            { id: 'hist_liuji_1', date: '03-14', label: '豆腐 / 豆干（调味）', totalAmount: 156, status: '待结算', plannedWeight: 26, actualWeight: 26, sentBasket: 2, returnedBasket: 2, operator: '老卢', photoCount: 1, items: [{ name: '豆腐', specLabel: '常规价 ¥2/斤', weight: 12, unitPrice: 2, subtotal: 24 }, { name: '豆干', specLabel: '调味 ¥6/斤', weight: 8, unitPrice: 6, subtotal: 48 }, { name: '豆干', specLabel: '未调味 ¥5/斤', weight: 6, unitPrice: 5, subtotal: 30 }] },
            { id: 'hist_liuji_2', date: '03-13', label: '豆腐 / 豆干（调味）', totalAmount: 156, status: '待结算', plannedWeight: 24, actualWeight: 24.2, sentBasket: 2, returnedBasket: 1, operator: '老卢', photoCount: 1, items: [{ name: '豆腐', specLabel: '常规价 ¥2/斤', weight: 12, unitPrice: 2, subtotal: 24 }, { name: '豆干', specLabel: '调味 ¥6/斤', weight: 8, unitPrice: 6, subtotal: 48 }] },
            { id: 'hist_liuji_3', date: '03-07', label: '上周结算单', totalAmount: 620, status: '已结算', plannedWeight: 0, actualWeight: 0, sentBasket: 0, returnedBasket: 0, operator: '老卢', photoCount: 0, items: [] },
        ],
    },
    {
        id: 'merchant_lingshou',
        name: '散户零售',
        type: '散户',
        address: '门店现场自提',
        phone: '到店结算',
        settlementDay: '当日结清',
        discountRate: 1,
        currentBasketCount: 0,
        pendingAmount: 0,
        settledAmount: 426,
        deliveryHistory: [
            { id: 'hist_lingshou_1', date: '03-14', label: '豆腐 / 脆皮豆腐', totalAmount: 38, status: '已结算', plannedWeight: 9, actualWeight: 9.2, sentBasket: 0, returnedBasket: 0, operator: '老卢', photoCount: 1, items: [{ name: '豆腐', specLabel: '常规价 ¥2/斤', weight: 4, unitPrice: 2, subtotal: 8 }, { name: '脆皮豆腐', specLabel: '常规价 ¥6/斤', weight: 5, unitPrice: 6, subtotal: 30 }] },
            { id: 'hist_lingshou_2', date: '03-13', label: '豆腐零售', totalAmount: 26, status: '已结算', plannedWeight: 6, actualWeight: 6, sentBasket: 0, returnedBasket: 0, operator: '老卢', photoCount: 1, items: [{ name: '豆腐', specLabel: '常规价 ¥2/斤', weight: 6, unitPrice: 2, subtotal: 12 }] },
        ],
    },
];

const DEFAULT_TASKS: DeliveryTask[] = [
    {
        id: 'task_dongqiao',
        merchantId: 'merchant_dongqiao',
        merchantName: '东桥生活超市',
        merchantType: '超市',
        address: '东桥路 18 号后门冷柜区',
        phone: '13800002211',
        routeEta: '07:10 前',
        status: '待拍照',
        settlementDay: '每月 5 日',
        plannedWeight: 42,
        actualWeight: 41.6,
        photoCount: 0,
        beforeBasketCount: 8,
        sentBasketCount: 3,
        returnedBasketCount: 2,
        signMethod: '口头确认',
        lastMessage: '黑豆腐今天多来 2 斤',
        operator: '老卢',
        items: [
            { id: 'i1', productId: 'prod_tofu', specId: 'spec_tofu_25', name: '豆腐', specLabel: '精品价 ¥2.5/斤', unitPrice: 2.5, quantity: 10, plannedWeight: 20 },
            { id: 'i2', productId: 'prod_black_tofu', specId: 'spec_black_tofu_4', name: '黑豆腐', specLabel: '常规价 ¥4/斤', unitPrice: 4, quantity: 5, plannedWeight: 10 },
            { id: 'i3', productId: 'prod_crispy_tofu', specId: 'spec_crispy_tofu_6', name: '脆皮豆腐', specLabel: '常规价 ¥6/斤', unitPrice: 6, quantity: 2, plannedWeight: 12 },
        ],
    },
    {
        id: 'task_liuji',
        merchantId: 'merchant_liuji',
        merchantName: '刘记早餐摊',
        merchantType: '小商贩',
        address: '城南早市 2 排 6 号',
        phone: '13900003322',
        routeEta: '07:30 前',
        status: '待复秤',
        settlementDay: '每周日',
        plannedWeight: 26,
        actualWeight: 26,
        photoCount: 0,
        beforeBasketCount: 4,
        sentBasketCount: 2,
        returnedBasketCount: 2,
        signMethod: '微信确认',
        lastMessage: '豆腐保持 2 元/斤，豆干要调味的',
        operator: '老卢',
        items: [
            { id: 'i4', productId: 'prod_tofu', specId: 'spec_tofu_2', name: '豆腐', specLabel: '常规价 ¥2/斤', unitPrice: 2, quantity: 6, plannedWeight: 12 },
            { id: 'i5', productId: 'prod_dry_tofu', specId: 'spec_seasoned_dry_6', name: '豆干', specLabel: '调味 ¥6/斤', unitPrice: 6, quantity: 2, plannedWeight: 8 },
            { id: 'i6', productId: 'prod_dry_tofu', specId: 'spec_plain_dry_5', name: '豆干', specLabel: '未调味 ¥5/斤', unitPrice: 5, quantity: 2, plannedWeight: 6 },
        ],
    },
    {
        id: 'task_lingshou',
        merchantId: 'merchant_lingshou',
        merchantName: '散户零售',
        merchantType: '散户',
        address: '门店现场自提',
        phone: '到店结算',
        routeEta: '随到随卖',
        status: '待送达',
        settlementDay: '当日结清',
        plannedWeight: 9,
        actualWeight: 9.2,
        photoCount: 1,
        beforeBasketCount: 0,
        sentBasketCount: 0,
        returnedBasketCount: 0,
        signMethod: '现金确认',
        lastMessage: '临时加了 1 斤脆皮豆腐',
        operator: '老卢',
        items: [
            { id: 'i7', productId: 'prod_tofu', specId: 'spec_tofu_2', name: '豆腐', specLabel: '常规价 ¥2/斤', unitPrice: 2, quantity: 2, plannedWeight: 4 },
            { id: 'i8', productId: 'prod_crispy_tofu', specId: 'spec_crispy_tofu_6', name: '脆皮豆腐', specLabel: '常规价 ¥6/斤', unitPrice: 6, quantity: 1, plannedWeight: 5 },
        ],
    },
];

const EXCEPTION_OPTIONS = ['缺货', '临时改量', '商户拒收', '重量差异过大'];

function parseActionParams(params?: string): Record<string, unknown> | null {
    if (!params) {
        return null;
    }

    try {
        return JSON.parse(params) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getViewportHeight(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const nextHeight = window.visualViewport?.height || window.innerHeight;
    return nextHeight > 0 ? `${Math.round(nextHeight)}px` : undefined;
}

function formatMoney(value: number) {
    return `¥${value.toFixed(0)}`;
}

function formatWeight(value: number) {
    return `${Number(value.toFixed(1))}斤`;
}

function getAfterBasketCount(task: DeliveryTask) {
    return task.beforeBasketCount + task.sentBasketCount - task.returnedBasketCount;
}

function getWeightDiff(task: DeliveryTask) {
    return Number((task.actualWeight - task.plannedWeight).toFixed(1));
}

function createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatSettlementDay(type: '日' | '周' | '月', value: string) {
    const num = Number(value);
    if (type === '日') return '每日结算';
    if (type === '周') return `每周${['日', '一', '二', '三', '四', '五', '六'][num] || value}`;
    return `每月 ${value} 日`;
}

function formatDiscountRate(rate: number) {
    if (rate >= 1) return '无优惠';
    return `${(rate * 10).toFixed(rate % 0.1 === 0 ? 0 : 1)} 折`;
}

function getProductById(products: ProductCatalog[], productId: string) {
    return products.find((product) => product.id === productId) || products[0];
}

function getSpecById(product: ProductCatalog | undefined, specId: string) {
    return product?.specs.find((spec) => spec.id === specId) || product?.specs[0];
}

function createManualLine(products: ProductCatalog[]): ManualEntryLine {
    const firstProduct = products[0];
    const firstSpec = firstProduct?.specs[0];
    return {
        id: createId('manual_line'),
        productId: firstProduct?.id || '',
        specId: firstSpec?.id || '',
        quantity: 1,
        plannedWeight: 10,
    };
}

function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (value: number) => void; min?: number; max?: number }) {
    return (
        <div className="tofu-ops__stepper">
            <button type="button" className="tofu-ops__stepper-btn" onClick={() => onChange(clamp(value - 1, min, max))}>
                <Minus size={14} />
            </button>
            <span className="tofu-ops__stepper-value">{value}</span>
            <button type="button" className="tofu-ops__stepper-btn" onClick={() => onChange(clamp(value + 1, min, max))}>
                <Plus size={14} />
            </button>
        </div>
    );
}

const Component = forwardRef<AxureHandle, AxureProps>(function TofuFactoryOps(props, ref) {
    const { data, config, onEvent } = props;
    const emitEvent = createEventEmitter(onEvent);

    const factoryName = getConfigValue(config, 'factory_name', '卢凡豆业');
    const operatorName = getConfigValue(config, 'operator_name', '老卢');
    const loginConfigUsername = String(getConfigValue(config, 'login_username', '13333563336')).trim();
    const loginConfigPassword = String(getConfigValue(config, 'login_password', '123456'));
    const loginDisplayName = String(getConfigValue(config, 'login_display_name', operatorName)).trim() || operatorName;
    const currentDate = String(getConfigValue(config, 'current_date', '2026-03-14'));
    const weightDiffThreshold = Number(getConfigValue(config, 'weight_diff_threshold', 0.5));
    const showBillTab = Boolean(getConfigValue(config, 'show_bill_tab', true));

    const dataTasks = getDataValue<unknown>(data, 'tasks', DEFAULT_TASKS);
    const dataMerchants = getDataValue<unknown>(data, 'merchants', DEFAULT_MERCHANTS);
    const dataProducts = getDataValue<unknown>(data, 'products', DEFAULT_PRODUCTS);

    const [viewportHeight, setViewportHeight] = useState<string | undefined>(() => getViewportHeight());
    const [activeTab, setActiveTab] = useState<MainTab>('home');
    const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('delivery');
    const [deliveryViewFilter, setDeliveryViewFilter] = useState<DeliveryViewFilter>('待配送');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginUsername, setLoginUsername] = useState(loginConfigUsername);
    const [loginPassword, setLoginPassword] = useState(loginConfigPassword);
    const [loginError, setLoginError] = useState('');
    const [tasks, setTasks] = useState<DeliveryTask[]>(() => Array.isArray(dataTasks) ? dataTasks as DeliveryTask[] : DEFAULT_TASKS);
    const [merchants, setMerchants] = useState<MerchantProfile[]>(() => Array.isArray(dataMerchants) ? dataMerchants as MerchantProfile[] : DEFAULT_MERCHANTS);
    const [products, setProducts] = useState<ProductCatalog[]>(() => Array.isArray(dataProducts) ? dataProducts as ProductCatalog[] : DEFAULT_PRODUCTS);
    const [selectedTaskId, setSelectedTaskId] = useState<string>(() => (Array.isArray(dataTasks) && dataTasks[0] && typeof (dataTasks[0] as DeliveryTask).id === 'string') ? (dataTasks[0] as DeliveryTask).id : DEFAULT_TASKS[0].id);
    const [showDetail, setShowDetail] = useState(false);
    const [taskFilter, setTaskFilter] = useState<'全部' | TaskStatus>('全部');
    const [taskSearch, setTaskSearch] = useState('');
    const [entryMode, setEntryMode] = useState<'manual' | 'paste' | 'ocr' | null>('ocr');
    const [manualMerchantId, setManualMerchantId] = useState<string>(() => DEFAULT_MERCHANTS[0].id);
    const [manageMerchantId, setManageMerchantId] = useState<string>(() => DEFAULT_MERCHANTS[0].id);
    const [manageView, setManageView] = useState<ManageView>('merchant');
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [manageMerchantSearch, setManageMerchantSearch] = useState('');
    const [showMerchantForm, setShowMerchantForm] = useState(false);
    const [showProductForm, setShowProductForm] = useState(false);
    const [selectedMerchantDetailId, setSelectedMerchantDetailId] = useState<string | null>(null);
    const [selectedProductEditId, setSelectedProductEditId] = useState<string | null>(null);
    const [ocrUploaded, setOcrUploaded] = useState(false);
    const [pasteText, setPasteText] = useState('东桥生活超市：豆腐20斤，黑豆腐10斤，脆皮豆腐12斤\n刘记早餐摊：豆腐12斤，豆干调味8斤，豆干未调味6斤');
    const [parsedOrders, setParsedOrders] = useState<Array<{ merchantName: string; items: Array<{ name: string; weight: number }> }>>([]);
    const [manualLines, setManualLines] = useState<ManualEntryLine[]>(() => [createManualLine(DEFAULT_PRODUCTS)]);
    const [merchantDraft, setMerchantDraft] = useState({
        name: '',
        type: '超市' as MerchantType,
        phone: '',
        address: '',
        settlementType: '月' as '日' | '周' | '月',
        settlementValue: '5',
        discountRate: '',
    });
    const [productDraft, setProductDraft] = useState({
        targetProductId: DEFAULT_PRODUCTS[0].id,
        newProductName: '',
        category: '豆腐类',
        specLabel: '',
        unitPrice: '2',
    });

    const loginAccounts = useMemo<LoginAccount[]>(() => ([
        {
            username: loginConfigUsername,
            password: loginConfigPassword,
            displayName: loginDisplayName,
        },
    ]), [loginConfigPassword, loginConfigUsername, loginDisplayName]);

    useEffect(() => {
        const syncViewportHeight = () => setViewportHeight(getViewportHeight());
        syncViewportHeight();

        if (typeof window === 'undefined') {
            return undefined;
        }

        window.addEventListener('resize', syncViewportHeight);
        window.addEventListener('orientationchange', syncViewportHeight);
        window.visualViewport?.addEventListener('resize', syncViewportHeight);

        return () => {
            window.removeEventListener('resize', syncViewportHeight);
            window.removeEventListener('orientationchange', syncViewportHeight);
            window.visualViewport?.removeEventListener('resize', syncViewportHeight);
        };
    }, []);

    useEffect(() => {
        if (!showBillTab && activeTab === 'manage') {
            setActiveTab('home');
        }
    }, [activeTab, showBillTab]);

    useEffect(() => {
        if (!merchants.some((merchant) => merchant.id === manualMerchantId) && merchants[0]) {
            setManualMerchantId(merchants[0].id);
        }
        if (!merchants.some((merchant) => merchant.id === manageMerchantId) && merchants[0]) {
            setManageMerchantId(merchants[0].id);
        }
    }, [manageMerchantId, manualMerchantId, merchants]);

    const selectedTask = useMemo(
        () => tasks.find((task) => task.id === selectedTaskId) || tasks[0],
        [selectedTaskId, tasks],
    );

    useEffect(() => {
        if (!selectedTask && tasks[0]) {
            setSelectedTaskId(tasks[0].id);
        }
    }, [selectedTask, tasks]);

    const pendingPhotoCount = useMemo(() => tasks.filter((task) => task.photoCount < 1).length, [tasks]);
    const pendingBasketCount = useMemo(() => tasks.reduce((sum, task) => sum + Math.max(0, getAfterBasketCount(task)), 0), [tasks]);
    const todayPendingTasks = useMemo(() => tasks.filter((task) => task.status !== '已完成'), [tasks]);
    const todayCompletedTasks = useMemo(() => tasks.filter((task) => task.status === '已完成'), [tasks]);
    const todayPendingWeight = useMemo(() => todayPendingTasks.reduce((sum, task) => sum + task.plannedWeight, 0), [todayPendingTasks]);
    const todayCompletedWeight = useMemo(() => todayCompletedTasks.reduce((sum, task) => sum + task.plannedWeight, 0), [todayCompletedTasks]);
    const homeMetrics = useMemo(() => ([
        { label: '今日任务', value: todayPendingTasks.length, suffix: `单 / ${todayPendingWeight.toFixed(0)}斤`, note: '待配送' },
        { label: '已完成任务', value: todayCompletedTasks.length, suffix: `单 / ${todayCompletedWeight.toFixed(0)}斤`, note: '已配送' },
        { label: '待回收筐', value: pendingBasketCount, suffix: '个', note: '按当前任务汇总' },
        { label: '待补照片', value: pendingPhotoCount, suffix: '单', note: '缺少复秤照片' },
    ]), [pendingBasketCount, pendingPhotoCount, todayCompletedTasks.length, todayCompletedWeight, todayPendingTasks.length, todayPendingWeight]);
    const searchedTasks = useMemo(() => {
        const keyword = taskSearch.trim().toLowerCase();
        if (!keyword) {
            return tasks;
        }
        return tasks.filter((task) => [
            task.merchantName,
            task.address,
            task.phone,
            task.status,
            task.items.map((item) => `${item.name} ${item.specLabel || ''}`).join(' '),
        ].join(' ').toLowerCase().includes(keyword));
    }, [taskSearch, tasks]);
    const searchedPendingTasks = useMemo(() => searchedTasks.filter((task) => task.status !== '已完成'), [searchedTasks]);
    const searchedCompletedTasks = useMemo(() => searchedTasks.filter((task) => task.status === '已完成'), [searchedTasks]);
    const filteredTasks = useMemo(() => {
        if (taskFilter === '全部') {
            return searchedTasks;
        }
        return searchedTasks.filter((task) => task.status === taskFilter);
    }, [taskFilter, searchedTasks]);
    const manualMerchant = useMemo(() => merchants.find((merchant) => merchant.id === manualMerchantId) || merchants[0], [manualMerchantId, merchants]);
    const manageMerchant = useMemo(() => merchants.find((merchant) => merchant.id === manageMerchantId) || merchants[0], [manageMerchantId, merchants]);
    const detailMerchantForHistory = useMemo(
        () => (selectedMerchantDetailId ? merchants.find((m) => m.id === selectedMerchantDetailId) : manageMerchant) || manageMerchant,
        [selectedMerchantDetailId, merchants, manageMerchant],
    );

    const selectedHistoryRecord = useMemo(() => {
        if (!selectedHistoryId || !detailMerchantForHistory) {
            return null;
        }
        return detailMerchantForHistory.deliveryHistory.find((h) => h.id === selectedHistoryId) || null;
    }, [selectedHistoryId, detailMerchantForHistory]);

    const filteredManageMerchants = useMemo(() => {
        const keyword = manageMerchantSearch.trim().toLowerCase();
        if (!keyword) {
            return merchants;
        }
        return merchants.filter((merchant) => [
            merchant.name,
            merchant.type,
            merchant.phone,
            merchant.address,
            merchant.settlementDay,
        ].join(' ').toLowerCase().includes(keyword));
    }, [manageMerchantSearch, merchants]);

    const currentAccountDisplayName = useMemo(
        () => loginAccounts.find((account) => account.username === loginUsername)?.displayName || operatorName,
        [loginAccounts, loginUsername, operatorName],
    );

    const manualPreview = useMemo(() => manualLines.map((line) => {
        const product = getProductById(products, line.productId);
        const spec = getSpecById(product, line.specId);
        const baseAmount = line.plannedWeight * (spec?.unitPrice || 0);
        const discountedAmount = baseAmount * (manualMerchant?.discountRate || 1);
        return {
            ...line,
            product,
            spec,
            baseAmount,
            discountedAmount,
        };
    }), [manualLines, manualMerchant, products]);

    const manualTotalWeight = useMemo(
        () => manualPreview.reduce((sum, line) => sum + line.plannedWeight, 0),
        [manualPreview],
    );
    const manualTotalAmount = useMemo(
        () => manualPreview.reduce((sum, line) => sum + line.discountedAmount, 0),
        [manualPreview],
    );

    const handleTabChange = (tab: MainTab) => {
        if (tab === 'manage' && !showBillTab) {
            setActiveTab('home');
            return;
        }
        if (tab === 'home') {
            setEntryMode((prev) => prev || 'ocr');
        }
        setActiveTab(tab);
        setShowDetail(false);
        emitEvent('on_tab_changed', JSON.stringify({ tab }));
    };

    const handleSelectTask = (taskId: string) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) {
            return;
        }
        setSelectedTaskId(taskId);
        setShowDetail(true);
        emitEvent('on_task_selected', JSON.stringify({ id: task.id, merchant_name: task.merchantName, status: task.status }));
    };

    const handleDataEntryOpen = (mode: 'manual' | 'paste' | 'ocr') => {
        setEntryMode(mode);
        setParsedOrders([]);
        setOcrUploaded(false);
        emitEvent('on_data_entry_opened', JSON.stringify({ mode }));
    };

    const handleParseText = () => {
        const lines = pasteText.trim().split('\n').filter((line) => line.trim());
        const results: Array<{ merchantName: string; items: Array<{ name: string; weight: number }> }> = [];
        for (const line of lines) {
            const colonIdx = line.indexOf('：');
            if (colonIdx === -1) continue;
            const merchantName = line.slice(0, colonIdx).trim();
            const itemStr = line.slice(colonIdx + 1);
            const items: Array<{ name: string; weight: number }> = [];
            const parts = itemStr.split(/[,，、]/);
            for (const part of parts) {
                const match = part.match(/(黑?豆腐|豆干|脆皮豆腐|豆腐)\s*(?:调味|未调味)?\s*(\d+(?:\.\d+)?)\s*斤/);
                if (match) {
                    const rawName = match[1];
                    const weight = Number(match[2]);
                    const spec = part.includes('调味') && !part.includes('未调味') ? '调味' : part.includes('未调味') ? '未调味' : '';
                    items.push({ name: spec ? `${rawName}（${spec}）` : rawName, weight });
                }
            }
            if (merchantName && items.length > 0) {
                results.push({ merchantName, items });
            }
        }
        setParsedOrders(results);
    };

    const handleOcrUpload = () => {
        setOcrUploaded(true);
        setParsedOrders([
            { merchantName: '东桥生活超市', items: [{ name: '豆腐', weight: 20 }, { name: '黑豆腐', weight: 10 }, { name: '脆皮豆腐', weight: 12 }] },
            { merchantName: '刘记早餐摊', items: [{ name: '豆腐', weight: 12 }, { name: '豆干（调味）', weight: 8 }, { name: '豆干（未调味）', weight: 6 }] },
        ]);
    };

    const handleSaveParsedOrder = (order: { merchantName: string; items: Array<{ name: string; weight: number }> }) => {
        const merchant = merchants.find((m) => m.name === order.merchantName) || merchants[0];
        if (!merchant) return;

        const nextItems: TaskItem[] = order.items.map((item) => {
            const product = products.find((p) => item.name.includes(p.name)) || products[0];
            const spec = product.specs[0];
            return {
                id: createId('task_item'),
                productId: product.id,
                specId: spec?.id,
                name: item.name,
                specLabel: spec?.label,
                unitPrice: spec?.unitPrice || 0,
                quantity: 1,
                plannedWeight: item.weight,
            };
        });

        const totalWeight = nextItems.reduce((sum, item) => sum + item.plannedWeight, 0);
        const nextTask: DeliveryTask = {
            id: createId('task'),
            merchantId: merchant.id,
            merchantName: merchant.name,
            merchantType: merchant.type,
            address: merchant.address,
            phone: merchant.phone,
            routeEta: '待安排',
            status: '待复秤',
            settlementDay: merchant.settlementDay,
            plannedWeight: totalWeight,
            actualWeight: totalWeight,
            photoCount: 0,
            beforeBasketCount: merchant.currentBasketCount,
            sentBasketCount: 0,
            returnedBasketCount: 0,
            signMethod: '待确认',
            lastMessage: entryMode === 'ocr' ? 'OCR 识别录入' : '粘贴文本录入',
            operator: currentAccountDisplayName,
            items: nextItems,
        };

        setTasks((prev) => [nextTask, ...prev]);
        setParsedOrders((prev) => prev.filter((o) => o !== order));
    };

    const handleLogin = () => {
        const username = loginUsername.trim();
        const matchedAccount = loginAccounts.find((account) => account.username === username && account.password === loginPassword);

        if (!matchedAccount) {
            setLoginError('账号或密码不正确');
            return;
        }

        setLoginUsername(matchedAccount.username);
        setLoginPassword(matchedAccount.password);
        setLoginError('');
        setIsLoggedIn(true);
        setActiveTab('home');
        setShowDetail(false);
        setTaskViewMode('delivery');
        setDeliveryViewFilter('待配送');
        setTaskFilter('全部');
        setTaskSearch('');
        setManageView('merchant');
        setEntryMode('ocr');
        emitEvent('on_login_success', JSON.stringify({ username: matchedAccount.username, display_name: matchedAccount.displayName }));
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setActiveTab('home');
        setShowDetail(false);
        setManageView('merchant');
        setSelectedHistoryId(null);
    };

    const updateTask = (taskId: string, updater: (task: DeliveryTask) => DeliveryTask) => {
        setTasks((prev) => prev.map((task) => task.id === taskId ? updater(task) : task));
    };

    const updateManualLine = (lineId: string, updater: (line: ManualEntryLine) => ManualEntryLine) => {
        setManualLines((prev) => prev.map((line) => line.id === lineId ? updater(line) : line));
    };

    const handleManualProductChange = (lineId: string, productId: string) => {
        const nextProduct = getProductById(products, productId);
        const nextSpecId = nextProduct?.specs[0]?.id || '';
        updateManualLine(lineId, (line) => ({
            ...line,
            productId,
            specId: nextSpecId,
        }));
    };

    const handleManualSpecChange = (lineId: string, specId: string) => {
        updateManualLine(lineId, (line) => ({ ...line, specId }));
    };

    const handleAddManualLine = () => {
        setManualLines((prev) => [...prev, createManualLine(products)]);
    };

    const handleRemoveManualLine = (lineId: string) => {
        setManualLines((prev) => prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev);
    };

    const handleSaveManualEntry = () => {
        if (!manualMerchant || manualPreview.length === 0) {
            return;
        }

        const nextItems: TaskItem[] = manualPreview.map((line) => ({
            id: createId('task_item'),
            productId: line.product.id,
            specId: line.spec?.id,
            name: line.product.name,
            specLabel: line.spec?.label,
            unitPrice: line.spec?.unitPrice || 0,
            quantity: line.quantity,
            plannedWeight: line.plannedWeight,
        }));

        const label = nextItems.map((item) => item.name).join(' / ');
        const totalWeight = nextItems.reduce((sum, item) => sum + item.plannedWeight, 0);
        const nextTask: DeliveryTask = {
            id: createId('task'),
            merchantId: manualMerchant.id,
            merchantName: manualMerchant.name,
            merchantType: manualMerchant.type,
            address: manualMerchant.address,
            phone: manualMerchant.phone,
            routeEta: '待安排',
            status: '待复秤',
            settlementDay: manualMerchant.settlementDay,
            plannedWeight: totalWeight,
            actualWeight: totalWeight,
            photoCount: 0,
            beforeBasketCount: manualMerchant.currentBasketCount,
            sentBasketCount: 0,
            returnedBasketCount: 0,
            signMethod: '待确认',
            lastMessage: '手动补录订单',
            operator: currentAccountDisplayName,
            note: `按 ${formatDiscountRate(manualMerchant.discountRate)} 结算`,
            items: nextItems,
        };

        setTasks((prev) => [nextTask, ...prev]);
        setMerchants((prev) => prev.map((merchant) => merchant.id === manualMerchant.id ? {
            ...merchant,
            pendingAmount: Number((merchant.pendingAmount + manualTotalAmount).toFixed(1)),
            deliveryHistory: [
                {
                    id: createId('history'),
                    date: currentDate.slice(5),
                    label,
                    totalAmount: Number(manualTotalAmount.toFixed(1)),
                    status: '待结算' as const,
                    plannedWeight: totalWeight,
                    actualWeight: totalWeight,
                    sentBasket: 0,
                    returnedBasket: 0,
                    operator: currentAccountDisplayName,
                    photoCount: 0,
                    items: nextItems.map((item) => ({
                        name: item.name,
                        specLabel: item.specLabel || '',
                        weight: item.plannedWeight,
                        unitPrice: item.unitPrice,
                        subtotal: item.plannedWeight * item.unitPrice,
                    })),
                },
                ...merchant.deliveryHistory,
            ],
        } : merchant));
        setManualLines([createManualLine(products)]);
        setEntryMode(null);
        setActiveTab('tasks');
        setTaskViewMode('delivery');
        setDeliveryViewFilter('待配送');
        setTaskFilter('全部');
        setSelectedTaskId(nextTask.id);
    };

    const handleAddMerchant = () => {
        const merchantName = merchantDraft.name.trim();
        if (!merchantName) {
            return;
        }

        const nextMerchant: MerchantProfile = {
            id: createId('merchant'),
            name: merchantName,
            type: merchantDraft.type,
            address: merchantDraft.address.trim() || '待补充地址',
            phone: merchantDraft.phone.trim() || '待补充电话',
            settlementDay: formatSettlementDay(merchantDraft.settlementType, merchantDraft.settlementValue),
            discountRate: merchantDraft.discountRate.trim() ? Math.max(0.1, Number(merchantDraft.discountRate) || 1) : 1,
            currentBasketCount: 0,
            pendingAmount: 0,
            settledAmount: 0,
            deliveryHistory: [],
        };

        setMerchants((prev) => [nextMerchant, ...prev]);
        setManualMerchantId(nextMerchant.id);
        setManageMerchantId(nextMerchant.id);
        setMerchantDraft({
            name: '',
            type: '超市',
            phone: '',
            address: '',
            settlementType: '月',
            settlementValue: '5',
            discountRate: '',
        });
        setShowMerchantForm(false);
        emitEvent('on_merchant_selected', JSON.stringify({ id: nextMerchant.id, merchant_name: nextMerchant.name }));
    };

    const handleMerchantDetailOpen = (merchantId: string) => {
        setSelectedMerchantDetailId(merchantId);
        setManageMerchantId(merchantId);
        setSelectedHistoryId(null);
        setManageView('merchantDetail');
        const merchant = merchants.find((item) => item.id === merchantId);
        if (merchant) {
            emitEvent('on_merchant_selected', JSON.stringify({ id: merchant.id, merchant_name: merchant.name }));
        }
    };

    const handleProductEditOpen = (productId: string) => {
        const product = products.find((p) => p.id === productId);
        if (product) {
            setSelectedProductEditId(productId);
            setProductDraft({
                targetProductId: productId,
                newProductName: product.name,
                category: product.category,
                specLabel: '',
                unitPrice: '2',
            });
            setManageView('productDetail');
        }
    };

    const handleAddProductSpec = () => {
        const unitPrice = Number(productDraft.unitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
            return;
        }

        const specLabel = productDraft.specLabel.trim() || `新规格 ¥${unitPrice}/斤`;

        if (productDraft.targetProductId === '__new__') {
            const newProductName = productDraft.newProductName.trim();
            if (!newProductName) {
                return;
            }
            const nextProduct: ProductCatalog = {
                id: createId('product'),
                name: newProductName,
                category: productDraft.category.trim() || '豆腐类',
                specs: [{
                    id: createId('spec'),
                    label: specLabel,
                    unitPrice,
                }],
            };
            setProducts((prev) => [...prev, nextProduct]);
            setProductDraft({
                targetProductId: nextProduct.id,
                newProductName: '',
                category: '豆腐类',
                specLabel: '',
                unitPrice: '2',
            });
            setShowProductForm(false);
            return;
        }

        setProducts((prev) => prev.map((product) => product.id === productDraft.targetProductId ? {
            ...product,
            specs: [
                ...product.specs,
                {
                    id: createId('spec'),
                    label: specLabel,
                    unitPrice,
                },
            ],
        } : product));
        setProductDraft((prev) => ({
            ...prev,
            specLabel: '',
            unitPrice: '2',
        }));
    };

    const handleWeightChange = (nextValue: number) => {
        if (!selectedTask) {
            return;
        }
        updateTask(selectedTask.id, (task) => {
            const actualWeight = Number.isFinite(nextValue) ? nextValue : task.actualWeight;
            const diff = Math.abs(actualWeight - task.plannedWeight);
            return {
                ...task,
                actualWeight,
                status: diff > weightDiffThreshold ? '异常' : (task.photoCount > 0 ? '待送达' : '待拍照'),
                exceptionReason: diff > weightDiffThreshold ? '重量差异过大' : task.exceptionReason,
            };
        });
        emitEvent('on_weight_confirmed', JSON.stringify({ id: selectedTask.id, actual_weight: nextValue }));
    };

    const handlePhotoAdd = () => {
        if (!selectedTask) {
            return;
        }
        const nextPhotoCount = selectedTask.photoCount + 1;
        updateTask(selectedTask.id, (task) => ({
            ...task,
            photoCount: nextPhotoCount,
            status: task.status === '待拍照' ? '待送达' : task.status,
        }));
        emitEvent('on_photo_updated', JSON.stringify({ id: selectedTask.id, photo_count: nextPhotoCount }));
    };

    const handleBasketChange = (field: 'sentBasketCount' | 'returnedBasketCount', value: number) => {
        if (!selectedTask) {
            return;
        }
        updateTask(selectedTask.id, (task) => ({ ...task, [field]: clamp(value, 0, 99) }));
        emitEvent('on_basket_changed', JSON.stringify({
            id: selectedTask.id,
            sent: field === 'sentBasketCount' ? value : selectedTask.sentBasketCount,
            returned: field === 'returnedBasketCount' ? value : selectedTask.returnedBasketCount,
        }));
    };

    const handleException = (reason: string, note = selectedTask?.exceptionNote || '') => {
        if (!selectedTask) {
            return;
        }
        updateTask(selectedTask.id, (task) => ({
            ...task,
            status: '异常',
            exceptionReason: reason,
            exceptionNote: note,
        }));
        emitEvent('on_exception_recorded', JSON.stringify({ id: selectedTask.id, reason, note }));
    };

    const handleExceptionNoteChange = (note: string) => {
        if (!selectedTask) {
            return;
        }
        updateTask(selectedTask.id, (task) => ({
            ...task,
            exceptionNote: note,
        }));
    };

    const handleSaveExceptionRecord = () => {
        if (!selectedTask) {
            return;
        }
        const reason = selectedTask.exceptionReason || '手动记录';
        handleException(reason, selectedTask.exceptionNote || '');
    };

    const handleComplete = () => {
        if (!selectedTask) {
            return;
        }
        const nextStatus: TaskStatus = selectedTask.photoCount > 0 ? '已完成' : '待拍照';
        updateTask(selectedTask.id, (task) => ({
            ...task,
            status: nextStatus,
            operator: operatorName,
        }));
        emitEvent('on_delivery_completed', JSON.stringify({ id: selectedTask.id, status: nextStatus, operator: operatorName }));
    };

    useImperativeHandle(ref, () => ({
        getVar(name: string) {
            const vars: Record<string, unknown> = {
                current_tab: activeTab,
                selected_task_id: selectedTask?.id,
                pending_photo_count: pendingPhotoCount,
                pending_basket_count: pendingBasketCount,
                is_logged_in: isLoggedIn,
                task_view_mode: taskViewMode,
            };
            return vars[name];
        },
        fireAction(name: string, params?: string) {
            const payload = parseActionParams(params);
            switch (name) {
                case 'switch_tab': {
                    const tab = payload?.tab;
                    if (tab === 'home' || tab === 'tasks' || tab === 'manage') {
                        handleTabChange(tab);
                    }
                    if (tab === 'bill') {
                        handleTabChange('manage');
                    }
                    return;
                }
                case 'select_task': {
                    const id = typeof payload?.id === 'string' ? payload.id : '';
                    if (id) {
                        handleSelectTask(id);
                    }
                    return;
                }
                case 'update_weight': {
                    const id = typeof payload?.id === 'string' ? payload.id : '';
                    const actualWeight = typeof payload?.actual_weight === 'number' ? payload.actual_weight : NaN;
                    if (id && Number.isFinite(actualWeight)) {
                        setSelectedTaskId(id);
                        updateTask(id, (task) => ({ ...task, actualWeight }));
                    }
                    return;
                }
                case 'set_photo_count': {
                    const id = typeof payload?.id === 'string' ? payload.id : '';
                    const photoCount = typeof payload?.photo_count === 'number' ? payload.photo_count : NaN;
                    if (id && Number.isFinite(photoCount)) {
                        updateTask(id, (task) => ({ ...task, photoCount: clamp(photoCount, 0, 9) }));
                    }
                    return;
                }
                case 'update_basket': {
                    const id = typeof payload?.id === 'string' ? payload.id : '';
                    const sent = typeof payload?.sent === 'number' ? payload.sent : NaN;
                    const returned = typeof payload?.returned === 'number' ? payload.returned : NaN;
                    if (id) {
                        updateTask(id, (task) => ({
                            ...task,
                            ...(Number.isFinite(sent) ? { sentBasketCount: sent } : {}),
                            ...(Number.isFinite(returned) ? { returnedBasketCount: returned } : {}),
                        }));
                    }
                    return;
                }
                case 'open_data_entry': {
                    const mode = payload?.mode;
                    if (mode === 'manual' || mode === 'paste' || mode === 'ocr') {
                        handleDataEntryOpen(mode);
                    }
                    return;
                }
                case 'complete_delivery': {
                    const id = typeof payload?.id === 'string' ? payload.id : selectedTask?.id;
                    if (id) {
                        setSelectedTaskId(id);
                        handleComplete();
                    }
                    return;
                }
                case 'record_exception': {
                    const id = typeof payload?.id === 'string' ? payload.id : selectedTask?.id;
                    const reason = typeof payload?.reason === 'string' ? payload.reason : '异常';
                    const note = typeof payload?.note === 'string' ? payload.note : '';
                    if (id) {
                        setSelectedTaskId(id);
                        handleException(reason, note);
                    }
                    return;
                }
                default:
                    console.warn('未知动作:', name);
            }
        },
        eventList: EVENT_LIST,
        actionList: ACTION_LIST,
        varList: VAR_LIST,
        configList: CONFIG_LIST,
        dataList: DATA_LIST,
    }), [activeTab, isLoggedIn, pendingBasketCount, pendingPhotoCount, selectedTask, taskViewMode, operatorName]);

    if (!selectedTask) {
        return null;
    }

    const selectedDiff = getWeightDiff(selectedTask);
    const selectedDiffAbs = Math.abs(selectedDiff);
    const afterBasketCount = getAfterBasketCount(selectedTask);
    const hasException = selectedTask.status === '异常';

    const renderHome = () => {
        return (
            <>
                <section className="tofu-ops__home-metrics-grid">
                    {homeMetrics.map((metric) => (
                        <div key={metric.label} className="tofu-ops__home-metric-card">
                            <span>{metric.label}</span>
                            <strong>{metric.value}<em>{metric.suffix}</em></strong>
                            <small>{metric.note}</small>
                        </div>
                    ))}
                </section>

                <section className="tofu-ops__section-head tofu-ops__section-head--compact">
                    <div>
                        <div className="tofu-ops__section-kicker">数据录入</div>
                        <h3>新增订单</h3>
                    </div>
                </section>

                <section className="tofu-ops__quick-grid">
                    <button type="button" className={`tofu-ops__quick-card ${entryMode === 'ocr' ? 'is-primary' : ''}`} onClick={() => handleDataEntryOpen('ocr')}>
                        <span className="tofu-ops__quick-icon"><ScanLine size={20} /></span>
                        <span>OCR 识别</span>
                        <small>拍微信截图</small>
                    </button>
                    <button type="button" className={`tofu-ops__quick-card ${entryMode === 'paste' ? 'is-primary' : ''}`} onClick={() => handleDataEntryOpen('paste')}>
                        <span className="tofu-ops__quick-icon"><ClipboardPaste size={20} /></span>
                        <span>粘贴订单</span>
                        <small>复制微信文字</small>
                    </button>
                    <button type="button" className={`tofu-ops__quick-card ${entryMode === 'manual' ? 'is-primary' : ''}`} onClick={() => handleDataEntryOpen('manual')}>
                        <span className="tofu-ops__quick-icon"><FileText size={20} /></span>
                        <span>手动补录</span>
                        <small>选商户、选商品</small>
                    </button>
                </section>

                {entryMode && (
                    <section className="tofu-ops__entry-panel">
                        <div className="tofu-ops__entry-panel-head">
                            <div>
                                <div className="tofu-ops__section-kicker">数据录入</div>
                                <h3>{entryMode === 'ocr' ? 'OCR 识别微信截图' : entryMode === 'paste' ? '粘贴微信订单' : '手动补录订单'}</h3>
                            </div>
                        </div>

                        {entryMode === 'ocr' && (
                            <div className="tofu-ops__entry-form">
                                {!ocrUploaded ? (
                                    <div className="tofu-ops__entry-upload">
                                        <ScanLine size={22} />
                                        <strong>点击上传或拍摄订单截图</strong>
                                        <span>识别后自动提取商户、商品、斤数和备注，可再人工核对。</span>
                                        <button type="button" onClick={handleOcrUpload}>选择截图</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="tofu-ops__entry-hint">
                                            <CheckCircle2 size={14} /> 已识别 {parsedOrders.length} 个商户的订单，核对后保存
                                        </div>
                                        {parsedOrders.map((order) => (
                                            <div key={order.merchantName} className="tofu-ops__parsed-card">
                                                <div className="tofu-ops__parsed-head">
                                                    <strong>{order.merchantName}</strong>
                                                    <span>{order.items.reduce((s, i) => s + i.weight, 0)} 斤</span>
                                                </div>
                                                <div className="tofu-ops__parsed-items">
                                                    {order.items.map((item, idx) => (
                                                        <span key={idx} className="tofu-ops__chip">{item.name} {item.weight}斤</span>
                                                    ))}
                                                </div>
                                                <button type="button" className="tofu-ops__entry-submit" onClick={() => handleSaveParsedOrder(order)}>保存为明日配送</button>
                                            </div>
                                        ))}
                                        {parsedOrders.length === 0 && (
                                            <div className="tofu-ops__entry-hint">
                                                <CheckCircle2 size={14} /> 全部订单已保存
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {entryMode === 'paste' && (
                            <div className="tofu-ops__entry-form">
                                <textarea
                                    value={pasteText}
                                    onChange={(event) => setPasteText(event.target.value)}
                                    placeholder="粘贴微信订单文字，每行一个商户&#10;格式：商户名：商品1 X斤，商品2 Y斤"
                                    rows={4}
                                />
                                <button type="button" className="tofu-ops__entry-submit" onClick={handleParseText}>解析订单文字</button>
                                {parsedOrders.length > 0 && (
                                    <>
                                        <div className="tofu-ops__entry-hint">
                                            <CheckCircle2 size={14} /> 识别到 {parsedOrders.length} 个商户，核对后保存
                                        </div>
                                        {parsedOrders.map((order) => (
                                            <div key={order.merchantName} className="tofu-ops__parsed-card">
                                                <div className="tofu-ops__parsed-head">
                                                    <strong>{order.merchantName}</strong>
                                                    <span>{order.items.reduce((s, i) => s + i.weight, 0)} 斤</span>
                                                </div>
                                                <div className="tofu-ops__parsed-items">
                                                    {order.items.map((item, idx) => (
                                                        <span key={idx} className="tofu-ops__chip">{item.name} {item.weight}斤</span>
                                                    ))}
                                                </div>
                                                <button type="button" className="tofu-ops__entry-submit" onClick={() => handleSaveParsedOrder(order)}>保存为明日配送</button>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        {entryMode === 'manual' && (
                            <div className="tofu-ops__entry-form">
                                <select value={manualMerchantId} onChange={(event) => setManualMerchantId(event.target.value)} aria-label="选择商户">
                                    {merchants.map((merchant) => (
                                        <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
                                    ))}
                                </select>
                                <div className="tofu-ops__entry-inline-grid">
                                    <div className="tofu-ops__entry-summary-card">
                                        <span>结算日</span>
                                        <strong>{manualMerchant?.settlementDay}</strong>
                                    </div>
                                    <div className="tofu-ops__entry-summary-card">
                                        <span>优惠倍率</span>
                                        <strong>{formatDiscountRate(manualMerchant?.discountRate || 1)}</strong>
                                    </div>
                                </div>
                                {manualPreview.map((line) => (
                                    <div className="tofu-ops__manual-line" key={line.id}>
                                        <div className="tofu-ops__entry-inline-grid is-2col">
                                            <select value={line.productId} onChange={(event) => handleManualProductChange(line.id, event.target.value)} aria-label="选择商品">
                                                {products.map((product) => (
                                                    <option key={product.id} value={product.id}>{product.name}</option>
                                                ))}
                                            </select>
                                            <select value={line.specId} onChange={(event) => handleManualSpecChange(line.id, event.target.value)} aria-label="选择规格">
                                                {line.product.specs.map((spec) => (
                                                    <option key={spec.id} value={spec.id}>{spec.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="tofu-ops__entry-inline-grid is-2col">
                                            <div className="tofu-ops__entry-stepper-card">
                                                <span>数量</span>
                                                <Stepper value={line.quantity} onChange={(value) => updateManualLine(line.id, (current) => ({ ...current, quantity: value }))} min={1} max={50} />
                                            </div>
                                            <div className="tofu-ops__entry-weight-card">
                                                <span>重量</span>
                                                <input
                                                    type="number"
                                                    value={line.plannedWeight}
                                                    min="0"
                                                    step="0.5"
                                                    onChange={(event) => updateManualLine(line.id, (current) => ({ ...current, plannedWeight: Number(event.target.value) || 0 }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="tofu-ops__manual-line-foot">
                                            <span>{line.product.name} · {line.spec?.label}</span>
                                            <strong>{formatMoney(line.discountedAmount)}</strong>
                                        </div>
                                        <button type="button" className="tofu-ops__ghost-btn" onClick={() => handleRemoveManualLine(line.id)} disabled={manualLines.length === 1}>
                                            删除这一行
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="tofu-ops__entry-secondary" onClick={handleAddManualLine}>+ 继续添加商品</button>
                                <div className="tofu-ops__entry-total">
                                    <div>
                                        <span>应配总重</span>
                                        <strong>{formatWeight(manualTotalWeight)}</strong>
                                    </div>
                                    <div>
                                        <span>按优惠后金额</span>
                                        <strong>{formatMoney(manualTotalAmount)}</strong>
                                    </div>
                                </div>
                                <button type="button" className="tofu-ops__entry-submit" onClick={handleSaveManualEntry}>保存为明日配送</button>
                            </div>
                        )}
                    </section>
                )}
            </>
        );
    };

    const renderTasks = () => {
        const deliveryTasks = deliveryViewFilter === '待配送' ? searchedPendingTasks : searchedCompletedTasks;

        return (
            <>
                <div className="tofu-ops__view-switch">
                    <button
                        type="button"
                        className={`tofu-ops__view-switch-btn ${taskViewMode === 'delivery' ? 'is-active' : ''}`}
                        onClick={() => setTaskViewMode('delivery')}
                    >
                        <Truck size={16} />
                        <span>当日送货</span>
                    </button>
                    <button
                        type="button"
                        className={`tofu-ops__view-switch-btn ${taskViewMode === 'list' ? 'is-active' : ''}`}
                        onClick={() => setTaskViewMode('list')}
                    >
                        <ClipboardList size={16} />
                        <span>全部送货</span>
                    </button>
                </div>

                <div className="tofu-ops__search-bar">
                    <input
                        value={taskSearch}
                        onChange={(event) => setTaskSearch(event.target.value)}
                        placeholder="搜索商户 / 地址 / 商品"
                        aria-label="搜索任务"
                    />
                    {taskSearch.trim() && (
                        <div className="tofu-ops__search-summary">
                            已按 "{taskSearch.trim()}" 过滤，共 {taskViewMode === 'delivery' ? deliveryTasks.length : filteredTasks.length} 条
                        </div>
                    )}
                </div>

                {taskViewMode === 'delivery' ? (
                    <>
                        <section className="tofu-ops__home-section tofu-ops__home-section--tasks">
                            <div className="tofu-ops__section-head">
                                <div>
                                    <div className="tofu-ops__section-kicker">{deliveryViewFilter}</div>
                                    <h3>{deliveryViewFilter === '待配送' ? '今天按顺序送货' : '今天已完成送货'}</h3>
                                </div>
                            </div>
                            <div className="tofu-ops__task-list">
                                {deliveryTasks.map((task) => {
                                    const taskAfterBasketCount = getAfterBasketCount(task);
                                    return (
                                        <button type="button" key={task.id} className="tofu-ops__task-card" onClick={() => handleSelectTask(task.id)}>
                                            <div className="tofu-ops__task-head">
                                                <div>
                                                    <div className="tofu-ops__task-name">{task.merchantName}</div>
                                                    <div className="tofu-ops__task-addr"><MapPin size={13} /> {task.address}</div>
                                                </div>
                                                <span className={`tofu-ops__badge tofu-ops__badge--${task.status}`}>{task.status}</span>
                                            </div>
                                            <div className="tofu-ops__task-nums">
                                                <span><Clock3 size={13} /> {task.routeEta}</span>
                                                <span><Scale size={13} /> {formatWeight(task.plannedWeight)}</span>
                                                <span><Package size={13} /> {taskAfterBasketCount}筐</span>
                                            </div>
                                            <div className="tofu-ops__task-chips">
                                                <span className="tofu-ops__chip">{task.photoCount} 张照片</span>
                                                {task.items.slice(0, 3).map((item) => (
                                                    <span key={item.id} className="tofu-ops__chip">{item.name} {item.plannedWeight}斤</span>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {deliveryTasks.length === 0 && (
                                <div className="tofu-ops__empty-block">没有匹配到送货任务</div>
                            )}
                        </section>
                    </>
                ) : (
                    <>
                        <div className="tofu-ops__filter-bar">
                            {(['全部', '待复秤', '待拍照', '待送达', '异常', '已完成'] as const).map((filter) => (
                                <button
                                    type="button"
                                    key={filter}
                                    className={`tofu-ops__filter-chip ${taskFilter === filter ? 'is-active' : ''}`}
                                    onClick={() => setTaskFilter(filter)}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                        <div className="tofu-ops__task-list">
                            {filteredTasks.map((task) => {
                                const taskAfterBasketCount = getAfterBasketCount(task);
                                return (
                                    <button type="button" key={task.id} className="tofu-ops__task-card" onClick={() => handleSelectTask(task.id)}>
                                        <div className="tofu-ops__task-head">
                                            <div>
                                                <div className="tofu-ops__task-name">{task.merchantName}</div>
                                                <div className="tofu-ops__task-addr"><MapPin size={13} /> {task.address}</div>
                                            </div>
                                            <span className={`tofu-ops__badge tofu-ops__badge--${task.status}`}>{task.status}</span>
                                        </div>
                                        <div className="tofu-ops__task-nums">
                                            <span><Scale size={13} /> {task.plannedWeight}/{task.actualWeight}斤</span>
                                            <span><Package size={13} /> {taskAfterBasketCount}筐</span>
                                            <span><Camera size={13} /> {task.photoCount}张</span>
                                        </div>
                                        <div className="tofu-ops__task-chips">
                                            {task.items.map((item) => (
                                                <span key={item.id} className="tofu-ops__chip">{item.name} {item.plannedWeight}斤</span>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {filteredTasks.length === 0 && (
                            <div className="tofu-ops__empty-block">没有匹配到任务列表</div>
                        )}
                    </>
                )}
            </>
        );
    };

    const renderDetail = () => (
        <>
            <div className="tofu-ops__detail-header">
                <button type="button" className="tofu-ops__back-btn" onClick={() => setShowDetail(false)}>
                    <ChevronLeft size={18} /> 返回
                </button>
                <span className={`tofu-ops__badge tofu-ops__badge--${selectedTask.status}`}>{selectedTask.status}</span>
            </div>

            <section className="tofu-ops__detail-hero">
                <div className="tofu-ops__detail-topline">
                    <span><Store size={15} /> {selectedTask.merchantType}</span>
                    <span><Clock3 size={15} /> {selectedTask.routeEta}</span>
                </div>
                <h2>{selectedTask.merchantName}</h2>
                <p><MapPin size={14} /> {selectedTask.address}</p>
                <div className="tofu-ops__detail-actions">
                    <button type="button"><Phone size={15} /> 联系</button>
                    <button type="button"><ReceiptText size={15} /> {selectedTask.settlementDay}</button>
                </div>
                {selectedTask.note && <div className="tofu-ops__merchant-note">{selectedTask.note}</div>}
            </section>

            <div className="tofu-ops__detail-flow">
                <section className="tofu-ops__card tofu-ops__card--active">
                    <div className="tofu-ops__card-head">
                        <div>
                            <div className="tofu-ops__section-kicker">第一步</div>
                            <div className="tofu-ops__card-title">复秤记录</div>
                        </div>
                        <Scale size={20} />
                    </div>
                    <div className="tofu-ops__weight-grid">
                        <div className="tofu-ops__weight-cell">
                            <div className="tofu-ops__weight-label">应配</div>
                            <div className="tofu-ops__weight-big">{selectedTask.plannedWeight}<span>斤</span></div>
                        </div>
                        <div className="tofu-ops__weight-cell is-editing">
                            <div className="tofu-ops__weight-label">实秤</div>
                            <input
                                className="tofu-ops__weight-input"
                                type="number"
                                value={selectedTask.actualWeight}
                                step="0.1"
                                onChange={(event) => handleWeightChange(Number(event.target.value))}
                            />
                        </div>
                    </div>
                    <div className={`tofu-ops__diff ${selectedDiffAbs > weightDiffThreshold ? 'is-warning' : ''}`}>
                        差异 {selectedDiff > 0 ? '+' : ''}{selectedDiff.toFixed(1)} 斤
                    </div>
                </section>

                <section className="tofu-ops__card">
                    <div className="tofu-ops__card-head">
                        <div>
                            <div className="tofu-ops__section-kicker">第二步</div>
                            <div className="tofu-ops__card-title">复秤照片</div>
                        </div>
                        <button type="button" className="tofu-ops__sm-btn" onClick={handlePhotoAdd}>
                            <Camera size={14} /> 拍照
                        </button>
                    </div>
                    <div className="tofu-ops__photo-grid">
                        {Array.from({ length: Math.max(3, selectedTask.photoCount || 1) }).map((_, index) => (
                            <div key={index} className={`tofu-ops__photo-slot ${index < selectedTask.photoCount ? 'has-photo' : ''}`}>
                                {index < selectedTask.photoCount ? <CheckCircle2 size={18} /> : <Camera size={18} />}
                                <span>{index < selectedTask.photoCount ? '已拍' : '待补'}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="tofu-ops__card">
                    <div className="tofu-ops__card-head">
                        <div>
                            <div className="tofu-ops__section-kicker">第三步</div>
                            <div className="tofu-ops__card-title">筐交接</div>
                        </div>
                        <Package size={20} />
                    </div>
                    <div className="tofu-ops__basket-summary">
                        <span>交接前 {selectedTask.beforeBasketCount} 个</span>
                        <strong>交接后 {afterBasketCount} 个</strong>
                    </div>
                    <div className="tofu-ops__basket-edit">
                        <div className="tofu-ops__basket-field">
                            <div className="tofu-ops__basket-label">本次送出</div>
                            <Stepper value={selectedTask.sentBasketCount} onChange={(value) => handleBasketChange('sentBasketCount', value)} />
                        </div>
                        <div className="tofu-ops__basket-field">
                            <div className="tofu-ops__basket-label">本次回收</div>
                            <Stepper value={selectedTask.returnedBasketCount} onChange={(value) => handleBasketChange('returnedBasketCount', value)} />
                        </div>
                    </div>
                </section>

                <section className="tofu-ops__card">
                    <div className="tofu-ops__card-head">
                        <div>
                            <div className="tofu-ops__section-kicker">商品</div>
                            <div className="tofu-ops__card-title">本单明细</div>
                        </div>
                        <ClipboardList size={20} />
                    </div>
                    {selectedTask.items.map((item) => (
                        <div key={item.id} className="tofu-ops__row">
                            <div>
                                <div className="tofu-ops__row-title">{item.name}</div>
                                <div className="tofu-ops__row-sub">{item.specLabel || `¥${item.unitPrice}/斤`} × {item.quantity}</div>
                            </div>
                            <div className="tofu-ops__row-val">{item.plannedWeight}斤</div>
                        </div>
                    ))}
                </section>

                <section className="tofu-ops__card tofu-ops__card--warning">
                    <div className="tofu-ops__card-head">
                        <div>
                            <div className="tofu-ops__section-kicker">可选</div>
                            <div className="tofu-ops__card-title">异常记录</div>
                        </div>
                        <AlertTriangle size={20} />
                    </div>
                    <div className="tofu-ops__exception-chips">
                        {EXCEPTION_OPTIONS.map((reason) => (
                            <button
                                type="button"
                                key={reason}
                                className={`tofu-ops__exc-chip ${selectedTask.exceptionReason === reason ? 'is-active' : ''}`}
                                onClick={() => handleException(reason)}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="tofu-ops__exception-note"
                        value={selectedTask.exceptionNote || ''}
                        onChange={(event) => handleExceptionNoteChange(event.target.value)}
                        placeholder="手动输入，非必填"
                        rows={3}
                    />
                    <button type="button" className="tofu-ops__record-btn" onClick={handleSaveExceptionRecord}>
                        保存异常记录
                    </button>
                    {(hasException || selectedTask.exceptionReason) && (
                        <div className="tofu-ops__warning">
                            <AlertTriangle size={14} /> {selectedTask.exceptionReason || '手动记录'}{selectedTask.exceptionNote ? ` · ${selectedTask.exceptionNote}` : ''}
                        </div>
                    )}
                </section>
            </div>

            <div className="tofu-ops__bottom-action">
                <button type="button" className="tofu-ops__main-btn" onClick={handleComplete}>
                    <CheckCircle2 size={18} /> 确认完成供货
                </button>
            </div>
        </>
    );

    const renderLogin = () => (
        <section className="tofu-ops__login-card">
            <div className="tofu-ops__login-brand">
                <div className="tofu-ops__login-logo">豆</div>
                <h1 className="tofu-ops__login-title">{factoryName}</h1>
                <p className="tofu-ops__login-subtitle">配货管理系统</p>
            </div>
            <div className="tofu-ops__entry-form tofu-ops__login-form">
                <input
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    placeholder="账号"
                    aria-label="登录账号"
                />
                <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="密码"
                    aria-label="登录密码"
                />
                {loginError && <div className="tofu-ops__login-error">{loginError}</div>}
                <button type="button" className="tofu-ops__login-submit" onClick={handleLogin}>登 录</button>
            </div>
        </section>
    );

    const renderManage = () => {
        const manageTabs: Array<{ key: ManageView; label: string; icon: React.ReactNode }> = [
            { key: 'merchant', label: '商户管理', icon: <Store size={16} /> },
            { key: 'product', label: '商品管理', icon: <Package size={16} /> },
        ];

        if (manageView === 'addMerchant') {
            return (
                <>
                    <div className="tofu-ops__detail-header">
                        <button type="button" className="tofu-ops__back-btn" onClick={() => setManageView('merchant')}>
                            <ChevronLeft size={18} /> 返回商户
                        </button>
                    </div>
                    <section className="tofu-ops__card">
                        <div className="tofu-ops__card-head">
                            <div className="tofu-ops__card-title">新增商户</div>
                        </div>
                        <div className="tofu-ops__entry-form tofu-ops__manage-form">
                            <input value={merchantDraft.name} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="商户名称" />
                            <select value={merchantDraft.type} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, type: event.target.value as MerchantType }))}>
                                <option value="超市">超市</option>
                                <option value="小商贩">小商贩</option>
                                <option value="散户">散户</option>
                            </select>
                            <input value={merchantDraft.phone} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, phone: event.target.value }))} placeholder="联系电话" />
                            <input value={merchantDraft.address} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, address: event.target.value }))} placeholder="送货地址" />
                            <div className="tofu-ops__entry-inline-grid is-2col">
                                <select value={merchantDraft.settlementType} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, settlementType: event.target.value as '日' | '周' | '月', settlementValue: event.target.value === '日' ? '' : prev.settlementValue }))}>
                                    <option value="日">每日结算</option>
                                    <option value="周">每周</option>
                                    <option value="月">每月</option>
                                </select>
                                {merchantDraft.settlementType === '周' ? (
                                    <select value={merchantDraft.settlementValue} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, settlementValue: event.target.value }))}>
                                        <option value="0">周日</option>
                                        <option value="1">周一</option>
                                        <option value="2">周二</option>
                                        <option value="3">周三</option>
                                        <option value="4">周四</option>
                                        <option value="5">周五</option>
                                        <option value="6">周六</option>
                                    </select>
                                ) : merchantDraft.settlementType === '月' ? (
                                    <input value={merchantDraft.settlementValue} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, settlementValue: event.target.value }))} placeholder="几号，如 5" type="number" min="1" max="31" />
                                ) : null}
                            </div>
                            <input value={merchantDraft.discountRate} onChange={(event) => setMerchantDraft((prev) => ({ ...prev, discountRate: event.target.value }))} placeholder="优惠倍率（不填默认无优惠）" />
                            <button type="button" className="tofu-ops__entry-submit" onClick={() => { handleAddMerchant(); setManageView('merchant'); }}>保存商户</button>
                        </div>
                    </section>
                </>
            );
        }

        if (manageView === 'addProduct') {
            return (
                <>
                    <div className="tofu-ops__detail-header">
                        <button type="button" className="tofu-ops__back-btn" onClick={() => setManageView('product')}>
                            <ChevronLeft size={18} /> 返回商品
                        </button>
                    </div>
                    <section className="tofu-ops__card">
                        <div className="tofu-ops__card-head">
                            <div className="tofu-ops__card-title">新增商品</div>
                        </div>
                        <div className="tofu-ops__entry-form tofu-ops__manage-form">
                            <select value={productDraft.targetProductId} onChange={(event) => setProductDraft((prev) => ({ ...prev, targetProductId: event.target.value }))}>
                                <option value="__new__">新增一个新商品</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>给"{product.name}"新增规格</option>
                                ))}
                            </select>
                            {productDraft.targetProductId === '__new__' && (
                                <>
                                    <input value={productDraft.newProductName} onChange={(event) => setProductDraft((prev) => ({ ...prev, newProductName: event.target.value }))} placeholder="新商品名称" />
                                    <input value={productDraft.category} onChange={(event) => setProductDraft((prev) => ({ ...prev, category: event.target.value }))} placeholder="商品分类" />
                                </>
                            )}
                            <input value={productDraft.specLabel} onChange={(event) => setProductDraft((prev) => ({ ...prev, specLabel: event.target.value }))} placeholder="规格名称，如 常规价 ¥2/斤" />
                            <input value={productDraft.unitPrice} onChange={(event) => setProductDraft((prev) => ({ ...prev, unitPrice: event.target.value }))} placeholder="单价" />
                            <button type="button" className="tofu-ops__entry-submit" onClick={() => { handleAddProductSpec(); setManageView('product'); }}>保存商品信息</button>
                        </div>
                    </section>
                </>
            );
        }

        if (manageView === 'merchantDetail') {
            const detailMerchant = merchants.find((m) => m.id === selectedMerchantDetailId) || manageMerchant;
            return (
                <>
                    <div className="tofu-ops__detail-header">
                        <button type="button" className="tofu-ops__back-btn" onClick={() => setManageView('merchant')}>
                            <ChevronLeft size={18} /> 返回商户
                        </button>
                    </div>

                    <section className="tofu-ops__card">
                        <div className="tofu-ops__card-head">
                            <div className="tofu-ops__card-title">{detailMerchant.name}</div>
                            <span className="tofu-ops__badge tofu-ops__badge--已收款">{formatDiscountRate(detailMerchant.discountRate)}</span>
                        </div>
                        <div className="tofu-ops__info-grid">
                            <div className="tofu-ops__info-item">
                                <span className="tofu-ops__info-label">电话</span>
                                <span className="tofu-ops__info-value">{detailMerchant.phone}</span>
                            </div>
                            <div className="tofu-ops__info-item">
                                <span className="tofu-ops__info-label">类型</span>
                                <span className="tofu-ops__info-value">{detailMerchant.type}</span>
                            </div>
                            <div className="tofu-ops__info-item">
                                <span className="tofu-ops__info-label">结算日</span>
                                <span className="tofu-ops__info-value">{detailMerchant.settlementDay}</span>
                            </div>
                            <div className="tofu-ops__info-item">
                                <span className="tofu-ops__info-label">欠筐</span>
                                <span className="tofu-ops__info-value">{detailMerchant.currentBasketCount} 个</span>
                            </div>
                            <div className="tofu-ops__info-item tofu-ops__info-item--full">
                                <span className="tofu-ops__info-label">地址</span>
                                <span className="tofu-ops__info-value">{detailMerchant.address}</span>
                            </div>
                        </div>
                    </section>

                    <section className="tofu-ops__card">
                        <div className="tofu-ops__card-head">
                            <div className="tofu-ops__card-title">配货历史</div>
                        </div>
                        {detailMerchant.deliveryHistory.length ? detailMerchant.deliveryHistory.map((history) => (
                            <button type="button" key={history.id} className={`tofu-ops__history-row ${selectedHistoryId === history.id ? 'is-expanded' : ''}`} onClick={() => setSelectedHistoryId(selectedHistoryId === history.id ? null : history.id)}>
                                <div className="tofu-ops__history-row-main">
                                    <div className="tofu-ops__history-row-date">{history.date}</div>
                                    <div className="tofu-ops__history-row-label">{history.label}</div>
                                </div>
                                <div className="tofu-ops__history-row-right">
                                    <span className={`tofu-ops__badge tofu-ops__badge--${history.status === '已结算' ? '已收款' : '未收款'}`}>{history.status}</span>
                                    <div className="tofu-ops__row-val">{formatMoney(history.totalAmount)}</div>
                                </div>
                            </button>
                        )) : <div className="tofu-ops__empty-block">暂无配货历史</div>}
                    </section>

                    {selectedHistoryRecord && (
                        <section className="tofu-ops__card">
                            <div className="tofu-ops__card-head">
                                <div className="tofu-ops__card-title">{selectedHistoryRecord.date} 详情</div>
                                <button type="button" className="tofu-ops__manage-action-btn is-muted" onClick={() => setSelectedHistoryId(null)}>关闭</button>
                            </div>
                            {selectedHistoryRecord.items.length > 0 && (
                                <div className="tofu-ops__history-items">
                                    {selectedHistoryRecord.items.map((item, idx) => (
                                        <div key={idx} className="tofu-ops__history-item">
                                            <div>
                                                <div className="tofu-ops__row-title">{item.name}</div>
                                                <div className="tofu-ops__row-sub">{item.specLabel} × {item.weight}斤</div>
                                            </div>
                                            <div className="tofu-ops__row-val">{formatMoney(item.subtotal)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedHistoryRecord.plannedWeight > 0 && (
                                <div className="tofu-ops__history-summary">
                                    <span>实秤 <strong>{formatWeight(selectedHistoryRecord.actualWeight)}</strong></span>
                                    <span>送筐 <strong>{selectedHistoryRecord.sentBasket}</strong></span>
                                    <span>收筐 <strong>{selectedHistoryRecord.returnedBasket}</strong></span>
                                    <span>照片 <strong>{selectedHistoryRecord.photoCount}</strong></span>
                                </div>
                            )}
                            {selectedHistoryRecord.photoCount > 0 && (
                                <div className="tofu-ops__history-photos">
                                    <div className="tofu-ops__photo-grid">
                                        {Array.from({ length: selectedHistoryRecord.photoCount }).map((_, idx) => (
                                            <div key={idx} className="tofu-ops__photo-slot has-photo">
                                                <Image size={18} />
                                                <span>照片 {idx + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {selectedHistoryRecord.note && (
                                <div className="tofu-ops__merchant-note">{selectedHistoryRecord.note}</div>
                            )}
                        </section>
                    )}
                </>
            );
        }

        if (manageView === 'productDetail') {
            const editProduct = products.find((p) => p.id === selectedProductEditId);
            return (
                <>
                    <div className="tofu-ops__detail-header">
                        <button type="button" className="tofu-ops__back-btn" onClick={() => setManageView('product')}>
                            <ChevronLeft size={18} /> 返回商品
                        </button>
                    </div>

                    {editProduct && (
                        <>
                            <section className="tofu-ops__card">
                                <div className="tofu-ops__card-head">
                                    <div className="tofu-ops__card-title">{editProduct.name}</div>
                                    <span className="tofu-ops__product-card-count">{editProduct.specs.length} 个规格</span>
                                </div>
                                <div className="tofu-ops__info-grid">
                                    <div className="tofu-ops__info-item">
                                        <span className="tofu-ops__info-label">分类</span>
                                        <span className="tofu-ops__info-value">{editProduct.category}</span>
                                    </div>
                                    <div className="tofu-ops__info-item">
                                        <span className="tofu-ops__info-label">商品 ID</span>
                                        <span className="tofu-ops__info-value">{editProduct.id}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="tofu-ops__card">
                                <div className="tofu-ops__card-head">
                                    <div className="tofu-ops__card-title">规格列表</div>
                                </div>
                                <div className="tofu-ops__product-specs">
                                    {editProduct.specs.map((spec) => (
                                        <div key={spec.id} className="tofu-ops__product-spec">
                                            <span className="tofu-ops__product-spec-label">{spec.label}</span>
                                            <span className="tofu-ops__product-spec-price">¥{spec.unitPrice}/斤</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="tofu-ops__card">
                                <div className="tofu-ops__card-head">
                                    <div className="tofu-ops__card-title">新增规格</div>
                                </div>
                                <div className="tofu-ops__entry-form tofu-ops__manage-form">
                                    <input value={productDraft.specLabel} onChange={(event) => setProductDraft((prev) => ({ ...prev, specLabel: event.target.value }))} placeholder="规格名称，如 调味 ¥6/斤" />
                                    <input value={productDraft.unitPrice} onChange={(event) => setProductDraft((prev) => ({ ...prev, unitPrice: event.target.value }))} placeholder="单价，如 6" type="number" min="0" step="0.5" />
                                    <button type="button" className="tofu-ops__entry-submit" onClick={() => { handleAddProductSpec(); setManageView('product'); }}>保存规格</button>
                                </div>
                            </section>
                        </>
                    )}
                </>
            );
        }

        return (
            <>
                <div className="tofu-ops__user-bar">
                    <div className="tofu-ops__user-info">
                        <div className="tofu-ops__user-name">{currentAccountDisplayName}</div>
                        <div className="tofu-ops__user-role">管理员</div>
                    </div>
                    <button type="button" className="tofu-ops__logout-btn" onClick={handleLogout}>退出</button>
                </div>

                <section className="tofu-ops__manage-tabs">
                    {manageTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`tofu-ops__manage-tab ${manageView === tab.key ? 'is-active' : ''}`}
                            onClick={() => setManageView(tab.key)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </section>

                {manageView === 'merchant' && (
                    <>
                        <div className="tofu-ops__manage-toolbar">
                            <div className="tofu-ops__search-bar tofu-ops__search-bar--compact">
                                <input
                                    value={manageMerchantSearch}
                                    onChange={(event) => setManageMerchantSearch(event.target.value)}
                                    placeholder="搜索商户名称、电话、地址"
                                    aria-label="搜索商户"
                                />
                            </div>
                            <button type="button" className="tofu-ops__manage-action-btn" onClick={() => setManageView('addMerchant')}>
                                <Plus size={14} /> 新增
                            </button>
                        </div>

                        <div className="tofu-ops__merchant-list">
                            {filteredManageMerchants.map((merchant) => (
                                <button
                                    type="button"
                                    key={merchant.id}
                                    className="tofu-ops__merchant-card"
                                    onClick={() => handleMerchantDetailOpen(merchant.id)}
                                >
                                    <div className="tofu-ops__merchant-card-top">
                                        <div className="tofu-ops__merchant-card-name">{merchant.name}</div>
                                        <span className="tofu-ops__merchant-card-type">{merchant.type}</span>
                                    </div>
                                    <div className="tofu-ops__merchant-card-stats">
                                        <div className="tofu-ops__merchant-stat">
                                            <span className="tofu-ops__merchant-stat-val">{formatMoney(merchant.pendingAmount)}</span>
                                            <span className="tofu-ops__merchant-stat-label">待结算</span>
                                        </div>
                                        <div className="tofu-ops__merchant-stat">
                                            <span className="tofu-ops__merchant-stat-val">{merchant.currentBasketCount}</span>
                                            <span className="tofu-ops__merchant-stat-label">欠筐</span>
                                        </div>
                                        <div className="tofu-ops__merchant-stat">
                                            <span className="tofu-ops__merchant-stat-val">{merchant.settlementDay}</span>
                                            <span className="tofu-ops__merchant-stat-label">结算日</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {filteredManageMerchants.length === 0 && (
                            <div className="tofu-ops__empty-block">没有匹配到商户</div>
                        )}
                    </>
                )}

                {manageView === 'product' && (
                    <>
                        <div className="tofu-ops__manage-toolbar">
                            <div className="tofu-ops__manage-toolbar-title">共 {products.length} 个商品</div>
                            <button
                                type="button"
                                className="tofu-ops__manage-action-btn"
                                onClick={() => {
                                    setProductDraft((prev) => ({ ...prev, targetProductId: '__new__' }));
                                    setManageView('addProduct');
                                }}
                            >
                                <Plus size={14} /> 新增
                            </button>
                        </div>

                        <div className="tofu-ops__manage-product-list">
                            {products.map((product) => (
                                <button
                                    type="button"
                                    key={product.id}
                                    className="tofu-ops__product-card"
                                    onClick={() => handleProductEditOpen(product.id)}
                                >
                                    <div className="tofu-ops__product-card-head">
                                        <div className="tofu-ops__product-card-name">{product.name}</div>
                                        <span className="tofu-ops__product-card-count">{product.specs.length} 个规格</span>
                                    </div>
                                    <div className="tofu-ops__product-specs">
                                        {product.specs.map((spec) => (
                                            <div key={spec.id} className="tofu-ops__product-spec">
                                                <span className="tofu-ops__product-spec-label">{spec.label}</span>
                                                <span className="tofu-ops__product-spec-price">¥{spec.unitPrice}/斤</span>
                                            </div>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </>
        );
    };

    return (
        <div className="tofu-ops" style={{ '--vh': viewportHeight } as React.CSSProperties}>
            <div className="tofu-ops__shell">
                <main className="tofu-ops__body">
                    {!isLoggedIn ? <div className="tofu-ops__login-wrap">{renderLogin()}</div> : showDetail ? renderDetail() : (
                        <>
                            {activeTab === 'home' && renderHome()}
                            {activeTab === 'tasks' && renderTasks()}
                            {activeTab === 'manage' && showBillTab && renderManage()}
                        </>
                    )}
                </main>

                {isLoggedIn && !showDetail && (
                    <nav className="tofu-ops__tabbar" aria-label="底部导航">
                        <button type="button" className={`tofu-ops__tab-btn ${activeTab === 'home' ? 'is-active' : ''}`} onClick={() => handleTabChange('home')}>
                            <Home size={20} />
                            <span>首页</span>
                        </button>
                        <button type="button" className={`tofu-ops__tab-btn ${activeTab === 'tasks' ? 'is-active' : ''}`} onClick={() => handleTabChange('tasks')}>
                            <ClipboardList size={20} />
                            <span>任务</span>
                        </button>
                        {showBillTab && (
                            <button type="button" className={`tofu-ops__tab-btn ${activeTab === 'manage' ? 'is-active' : ''}`} onClick={() => handleTabChange('manage')}>
                                <ReceiptText size={20} />
                                <span>基础管理</span>
                            </button>
                        )}
                    </nav>
                )}
            </div>
        </div>
    );
});

export default Component;