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
     * @param {number} y - 放置的 Y 座標 (通常由外部計算好傳入)
     */
    render(canvas, x, y) {
        // 1. 建立背景方塊
        const boxWidth = 100;
        const boxHeight = 80;
        const bgRect = new fabric.Rect({
            width: boxWidth, height: boxHeight,
            fill: '#333333', stroke: '#ffffff', strokeWidth: 1,
            rx: 5, ry: 5,
            originX: 'center', originY: 'center', strokeUniform: true
        });

        // 2. 建立文字
        const textObj = new fabric.Text(`${this.name}`, {
            fontSize: 16, fill: '#ffffff',
            originX: 'center', originY: 'center'
        });

        // 3. 建立群組
        this.fabricGroup = new fabric.Group([bgRect, textObj], {
            left: x, top: y, // 使用傳入的 y
            originX: 'center', originY: 'center',
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
            const halfWidth = (group.width * group.scaleX) / 2;

            if (group.left - halfWidth < bounds.minX) group.left = bounds.minX + halfWidth;
            if (group.left + halfWidth > bounds.maxX) group.left = bounds.maxX - halfWidth;

            // 更新時間
            this.startTime = timelineOffset + (group.left * secondsPerPixel);
            // 更新時間相關欄位，保留原本的參數
            /*if (window.globalEffectData[this.id]) {
                window.globalEffectData[this.id].startTime = this.startTime;
            
            }*/
        });

        // 縮放時
        group.on('scaling', () => {
            const bounds = this._getSafeBoundaries(canvas);
            const halfWidth = (group.width * group.scaleX) / 2;

            // 抗文字拉伸
            textObj.set({ scaleX: 1 / group.scaleX, scaleY: 1 / group.scaleY });

            // 邊界檢查
            if (group.left - halfWidth < bounds.minX) {
                const maxW = (group.left - bounds.minX) * 2;
                group.scaleX = maxW / group.width;
                group.left = bounds.minX + (group.width * group.scaleX) / 2;
            }
            if (group.left + halfWidth > bounds.maxX) {
                const maxW = (bounds.maxX - group.left) * 2;
                group.scaleX = maxW / group.width;
                group.left = bounds.maxX - (group.width * group.scaleX) / 2;
            }

            // 更新 Duration 與 Time
            const currentWidthPx = group.width * group.scaleX;
            this.duration = currentWidthPx * secondsPerPixel;
            this.startTime = timelineOffset + (group.left * secondsPerPixel);
        });
    }

    // 內部：取得邊界
    _getSafeBoundaries(canvas) {
        let minX = 0;
        let maxX = canvas.getWidth();
        const activeObj = this.fabricGroup;

        canvas.getObjects().forEach(other => {
            if (other === activeObj) return;

            const otherHalfWidth = (other.width * other.scaleX) / 2;
            if (other.left < activeObj.left) {
                const edge = other.left + otherHalfWidth;
                if (edge > minX) minX = edge;
            }
            if (other.left > activeObj.left) {
                const edge = other.left - otherHalfWidth;
                if (edge < maxX) maxX = edge;
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