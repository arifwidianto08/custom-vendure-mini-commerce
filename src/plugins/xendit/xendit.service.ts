import { Inject, Injectable } from '@nestjs/common';
import {
	Customer,
	Logger,
	Order,
	RequestContext,
	TransactionalConnection,
} from '@vendure/core';
import { XENDIT_PLUGIN_OPTIONS } from './constant';
import { XenditCreateInvoiceResponse, XenditPluginOptions } from './types';
import { HttpService } from '@nestjs/axios';
import { map, tap } from 'rxjs/operators';

@Injectable()
export class XenditService {
	constructor(
		private connection: TransactionalConnection,
		@Inject(XENDIT_PLUGIN_OPTIONS) private options: XenditPluginOptions,
		private httpService: HttpService,
	) {
		// this.request = Axios.create({
		// 	baseURL: 'https://api.xendit.co',
		// 	auth: {
		// 		username: this.options.apiKey,
		// 		password: '',
		// 	},
		// });
	}

	async createPayment(
		ctx: RequestContext,
		order: Order,
	): Promise<XenditCreateInvoiceResponse> {
		try {
			const customer = await this.getCustomer(order);
			const payload = {
				amount: order.totalWithTax,
				external_id: order.code,
				currency: 'IDR',
				payer_email: customer.emailAddress,
				description: ctx.channel.token + '_' + order.id,
				invoice_duration: this.options.invoiceDuration || 60 * 60 * 24, // Default 1 day
				payment_methods: this.options.paymentMethods || [],
			};

			console.log('Xendit API Key : ', this.options.apiKey);
			console.log('Xendit Payload :', payload);

			const payment = this.httpService
				.post('https://api.xendit.co/v2/invoices', payload, {
					auth: {
						username: this.options.apiKey,
						password: '',
					},
				})
				.pipe(
					tap((resp) => console.log(resp)),
					map((resp) => resp.data),
					tap((data) => {
						console.log(data);
						return data;
					}),
				);

			console.log('payment : ', payment);
			return payment as any;
		} catch (error: any) {
			console.log('Error on Create Xendit Payment : ', error as any);

			console.log(
				`Error Response on Create Xendit Payment : \n${JSON.stringify(
					error?.response,
				)}`,
			);

			console.log(
				`Error Response Data on Create Xendit Payment : \n${JSON.stringify(
					error?.response?.data,
				)}`,
			);

			throw new Error(`Error on Creating Xendit Payment`);
		}
	}

	async cancelPayment(
		_ctx: RequestContext,
		xenditPaymentId: string,
	): Promise<XenditCreateInvoiceResponse> {
		try {
			const { data: payment } = await this.httpService
				.post(`/invoices/${xenditPaymentId}/expire!`)
				.toPromise();

			return payment;
		} catch (error) {
			throw new Error(`Error on Canceling Xendit Payment`);
		}
	}

	/**
	 * Xendit have their refund policy for each payment mate, idk but it just too much for me, lol
	 * probably not gonna make it soon
	 */
	async createRefund(paymentIntentId: string, amount: number) {
		// TODO: Consider passing the "reason" property once this feature request is addressed:
		// https://github.com/vendure-ecommerce/vendure/issues/893
		return;
	}

	private async getCustomer(activeOrder: Order): Promise<Customer> {
		if (activeOrder?.customer?.emailAddress) {
			return activeOrder?.customer;
		}

		// Load relation with customer not available in the response from activeOrderService.getOrderFromContext()
		const order = await this.connection
			.getRepository(Order)
			.findOne(activeOrder.id, {
				relations: ['customer'],
			});

		if (!order || !order.customer) {
			// This should never happen
			throw new Error(`Customer not found.`);
		}

		const { customer } = order;

		return customer;
	}

	/**
	 * Xendit can optionally sign the callback events it sends to your endpoints.
	 * They include a token in each event's `x-callback-token` header that allows you to verify that the events were sent by Xendit, not by a third party.
	 */
	async verifyCallback(callbackToken?: string) {
		return (
			this.options?.callbackToken?.length &&
			this.options?.callbackToken !== callbackToken
		);
	}
}
