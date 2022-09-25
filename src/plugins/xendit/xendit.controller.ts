import {
	Controller,
	Headers,
	HttpStatus,
	Post,
	Req,
	Res,
} from '@nestjs/common';
import {
	InternalServerError,
	LanguageCode,
	Logger,
	Order,
	OrderService,
	PaymentMethod,
	RequestContext,
	RequestContextService,
	TransactionalConnection,
} from '@vendure/core';
import { OrderStateTransitionError } from '@vendure/core/dist/common/error/generated-graphql-shop-errors';
import { Response } from 'express';
import { loggerCtx } from './constant';
import { xenditPaymentMethodHandler } from './xendit.handler';
import { XenditService } from './xendit.service';
import { RequestWithRawBody, XenditCallbackRequest } from './types';

const missingHeaderErrorMessage = 'Missing xendit-signature header';
const signatureErrorMessage = 'Error verifying Xendit webhook signature';
const noPaymentIntentErrorMessage = 'No payment intent in the event payload';

@Controller('payments')
export class XenditController {
	constructor(
		private connection: TransactionalConnection,
		private orderService: OrderService,
		private xenditService: XenditService,
		private requestContextService: RequestContextService,
	) {}

	@Post('xendit')
	async webhook(
		@Headers('x-callback-token') callbackToken: string | undefined,
		@Req() request: RequestWithRawBody,
		@Res() response: Response,
	): Promise<void> {
		if (!callbackToken) {
			Logger.error(missingHeaderErrorMessage, loggerCtx);
			response.status(HttpStatus.BAD_REQUEST).send(missingHeaderErrorMessage);
			return;
		}

		try {
			await this.xenditService.verifyCallback(callbackToken);
		} catch (e: any) {
			Logger.error(
				`${signatureErrorMessage} ${callbackToken}: ${e.message}`,
				loggerCtx,
			);
			response.status(HttpStatus.BAD_REQUEST).send(signatureErrorMessage);
			return;
		}

		console.log('x-callback-token : ', callbackToken);

		const xenditPayment = request.body as XenditCallbackRequest;
		if (!xenditPayment) {
			Logger.error(noPaymentIntentErrorMessage, loggerCtx);
			response.status(HttpStatus.BAD_REQUEST).send(noPaymentIntentErrorMessage);
			return;
		}

		console.log('XenditPayment : ', xenditPayment);

		const channelToken = xenditPayment.description.split('_')[0];
		const orderCode = xenditPayment.external_id;
		const ctx = await this.createContext(channelToken, request);

		const order = await this.orderService.findOneByCode(ctx, orderCode);
		if (!order) {
			throw Error(
				`Unable to find order ${orderCode}, unable to settle payment ${xenditPayment.id}!`,
			);
		}

		if (order.state !== 'ArrangingPayment') {
			const transitionToStateResult = await this.orderService.transitionToState(
				ctx,
				order.id,
				'ArrangingPayment',
			);

			if (transitionToStateResult instanceof OrderStateTransitionError) {
				Logger.error(
					`Error transitioning order ${orderCode} to ArrangingPayment state: ${transitionToStateResult.message}`,
					loggerCtx,
				);
				return;
			}
		}

		const paymentMethod = await this.getPaymentMethod(ctx);

		const addPaymentToOrderResult = await this.orderService.addPaymentToOrder(
			ctx,
			order.id,
			{
				method: paymentMethod.code,
				metadata: xenditPayment,
			},
		);

		if (!(addPaymentToOrderResult instanceof Order)) {
			Logger.error(
				`Error adding payment to order ${orderCode}: ${addPaymentToOrderResult.message}`,
				loggerCtx,
			);
			return;
		}

		Logger.info(
			`Xendit payment id ${xenditPayment.id} added to order ${orderCode}`,
			loggerCtx,
		);
		response.status(HttpStatus.OK).send('Ok');
	}

	private async createContext(
		channelToken: string,
		req: RequestWithRawBody,
	): Promise<RequestContext> {
		return this.requestContextService.create({
			apiType: 'admin',
			channelOrToken: channelToken,
			req,
			languageCode: LanguageCode.en,
		});
	}

	private async getPaymentMethod(ctx: RequestContext): Promise<PaymentMethod> {
		const method = (
			await this.connection.getRepository(ctx, PaymentMethod).find()
		).find((m) => m.handler.code === xenditPaymentMethodHandler.code);

		if (!method) {
			throw new InternalServerError(
				`[${loggerCtx}] Could not find Xendit PaymentMethod`,
			);
		}

		return method;
	}
}
