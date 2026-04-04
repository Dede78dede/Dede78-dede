import { RoutingContext, IRouterMiddleware } from './types';

export class RouterPipeline {
  private middlewares: IRouterMiddleware[] = [];

  public use(middleware: IRouterMiddleware): void {
    this.middlewares.push(middleware);
  }

  public async execute(context: RoutingContext): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      if (i < this.middlewares.length) {
        const middleware = this.middlewares[i];
        await middleware.handle(context, () => dispatch(i + 1));
      }
    };

    await dispatch(0);
  }
}
