import * as React from 'react';
import {cn} from '@/lib/utils';

/** 图片格式（保留兼容调用方，本组件不参与图片格式转换） */
type ImageFormat = 'jpg' | 'png' | 'webp' | 'bmp' | 'gif' | 'tiff';

type NativeImgProps = React.ComponentPropsWithoutRef<'img'>;

export interface ImageProps extends NativeImgProps {
    /** 图片质量，脱离妙搭后不再参与 CDN 处理，仅保留接口兼容 */
    quality?: number;
    /** 图片格式，同上，仅保留接口兼容 */
    format?: ImageFormat;
    /** 响应式断点，同上，仅保留接口兼容 */
    breakpoints?: Array<number>;
}

/**
 * 图片组件（脱离妙搭版）
 * - 保留妙搭版的 props 签名，调用方无需改动
 * - 内部直接用原生 <img>，不再走妙搭 CDN 参数拼接
 * - 默认 lazy 加载 + 异步解码 + 灰底占位
 */
export const Image = React.forwardRef<HTMLImageElement, ImageProps>(
    (
        {
            src,
            className,
            loading = 'lazy',
            decoding = 'async',
            // 以下三个参数仅为兼容旧调用方，不参与渲染逻辑
            quality: _quality,
            format: _format,
            breakpoints: _breakpoints,
            ...rest
        },
        ref,
    ) => {
        return (
            <img
                {...rest}
                ref={ref}
                src={src}
                className={cn(
                    // 灰色渐变占位，图未加载完时不至于空白突兀
                    'bg-linear-to-b from-gray-50/20 to-gray-200/20',
                    className,
                )}
                loading={loading}
                decoding={decoding}
            />
        );
    },
);

Image.displayName = 'Image';

export default Image;