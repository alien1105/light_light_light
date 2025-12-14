// 檔案名稱：EffectBlock.js

class EffectBlock {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        
        // 時間資料
        this.startTime = 0;
        this.duration = 1;

        // Fabric 物件參考
        this.fabricGroup = null;
    }
    // 讀取 block.params 時，自動去全域資料庫，用 ID 找出對應的參數
    get params() {
        return globalEffectData[this.id] || {};
    }

    // 寫入 block.params 時，自動更新全域資料庫
    set params(newParams) {
        window.globalEffectData[this.id] = {
            ...newParams,
            id: this.id,       
            name: this.name,    
            startTime: this.startTime,
            duration: this.duration
        };
    }
    /**
     * 在畫布上渲染方塊
     * @param {fabric.Canvas} canvas - 目標畫布
     * @param {number} x - 放置的 X 座標
     * @param {number} y - 放置的 Y 座標
     */
    render(canvas, x, y) {
        // 建立背景方塊
        const boxWidth = 100;
        const boxHeight = 80;
        const bgRect = new fabric.Rect({
            width: boxWidth, height: boxHeight,
            fill: '#333333', stroke: '#ffffff', strokeWidth: 1,
            rx: 5, ry: 5,
            originX: 'center', originY: 'center', strokeUniform: true
        });

        // 建立文字
        const textObj = new fabric.Text(`${this.name}`, {
            fontSize: 16, fill: '#ffffff',
            originX: 'center', originY: 'center'
        });

        // 建立群組
        this.fabricGroup = new fabric.Group([bgRect, textObj], {
            left: x, top: y, // 使用傳入的 y
            originX: 'left', originY: 'center',
            selectable: true,
            lockMovementY: true, lockScalingY: true, lockRotation: true,
            hasBorders: false, cornerColor: 'white', cornerSize: 10,
            transparentCorners: false, objectCaching: false
        });

        // 關鍵：將 Class 實例綁定到 Fabric 物件上
        this.fabricGroup.logicBlock = this; 

        // 設定控制點
        this.fabricGroup.setControlsVisibility({
            mt: false, mb: false, ml: true, mr: true,
            bl: false, br: false, tl: false, tr: false, mtr: false
        });

        // 初始化時間與大小
        // 注意：這裡假設 secondsPerPixel 與 timelineOffset 是全域變數
        this.updateDimensionsFromTime();
        this.startTime = timelineOffset + (x * secondsPerPixel); 

        // 綁定事件
        this._bindEvents(canvas);

        // 加入畫布
        canvas.add(this.fabricGroup);
        return this.fabricGroup;
    }

    // 內部：綁定 Fabric 事件
    _bindEvents(canvas) {
        const group = this.fabricGroup;
        const textObj = group.item(1);

        // 移動時
        group.on('moving', () => {
            const bounds = this._getSafeBoundaries(canvas);
            const currentWidth = group.getScaledWidth();

            if (group.left < bounds.minX) group.left = bounds.minX;
            if (group.left + currentWidth > bounds.maxX) group.left = bounds.maxX - currentWidth;

            // 更新內部時間
            this.startTime = timelineOffset + (group.left * secondsPerPixel);

            // 即時寫入資料庫
            if (window.globalEffectData[this.id]) {
                window.globalEffectData[this.id].startTime = this.startTime;
            }
           
        });

        // 縮放時
        group.on('scaling', () => {
            const bounds = this._getSafeBoundaries(canvas);
            const currentWidth = group.getScaledWidth();

            // 抗文字拉伸
            textObj.set({ scaleX: 1 / group.scaleX, scaleY: 1 / group.scaleY });

            // 邊界檢查
            if (group.left  < bounds.minX) {
                group.left = bounds.minX 
            }
            if (group.left + currentWidth > bounds.maxX) {
                // 如果右邊撞牆，限制寬度
                const maxWidth = bounds.maxX - group.left;
                group.scaleX = maxWidth / group.width;
            }

            // 更新 Duration 與 Time
            this.duration = group.getScaledWidth() * secondsPerPixel;
            this.startTime = timelineOffset + (group.left * secondsPerPixel);

            // 即時寫入資料庫
            if (window.globalEffectData[this.id]) {
                window.globalEffectData[this.id].startTime = this.startTime;
                window.globalEffectData[this.id].duration = this.duration;
            }
        });
    }

    // 內部：取得邊界
    _getSafeBoundaries(canvas) {
        let minX = 0;
        let maxX = canvas.getWidth();
        const activeObj = this.fabricGroup;

        canvas.getObjects().forEach(other => {
            if (other === activeObj) return;
            if (!other.logicBlock) return;

            const otherLeft = other.left;
            const otherRight = other.left + other.getScaledWidth();
            const activeLeft = activeObj.left;

            // 如果對方在我的左邊
            if (otherRight <= activeLeft) {
                if (otherRight > minX) minX = otherRight;
            }
            // 如果對方在我的右邊
            if (otherLeft >= activeLeft) {
                if (otherLeft < maxX) maxX = otherLeft;
            }
        });
        return { minX, maxX };
    }

    // 工具：根據目前的 duration 設定 scaleX
    updateDimensionsFromTime() {
        if (!this.fabricGroup) return;
        const targetWidthPx = this.duration / secondsPerPixel;
        this.fabricGroup.scaleX = targetWidthPx / this.fabricGroup.width;
        
        // 修正文字
        const textObj = this.fabricGroup.item(1);
        if(textObj) {
            textObj.set({ scaleX: 1 / this.fabricGroup.scaleX, scaleY: 1 });
        }
    }
}