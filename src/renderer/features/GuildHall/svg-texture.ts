import { ImageSource, Texture } from 'pixi.js';

/**
 * Rasterizes SVG markup into a texture whose size in pixels-per-unit is `resolution`.
 *
 * Pixi's own SVG loader fetches the file, which fails for file:// URLs in the packaged app and is
 * blocked by the CSP (connect-src) for data: URLs. An <img> with a data: URL is allowed by
 * `img-src 'self' data:`, so the SVG is decoded that way and drawn onto a canvas.
 */
export async function createSvgTexture(svgMarkup: string, resolution: number): Promise<Texture> {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(image.width * resolution);
    canvas.height = Math.ceil(image.height * resolution);
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('A 2D canvas context is not available to rasterize SVG art.');
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const source = new ImageSource({ resource: canvas, resolution, alphaMode: 'premultiply-alpha-on-upload' });
    return new Texture({ source });
}
