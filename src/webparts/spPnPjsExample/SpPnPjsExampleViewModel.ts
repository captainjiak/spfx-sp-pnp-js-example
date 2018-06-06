import * as ko from 'knockout';
import styles from './SpPnPjsExample.module.scss';
import { ISpPnPjsExampleWebPartProps } from './SpPnPjsExampleWebPart';
import pnp, { List, ListEnsureResult, ItemAddResult, FieldAddResult } from "sp-pnp-js";

export interface ISpPnPjsExampleBindingContext extends ISpPnPjsExampleWebPartProps {
  shouter: KnockoutSubscribable<{}>;
}

/**
 * Interface which defines the fields in our list items
 */
export interface OrderListItem {
  Id: number;
  Title: string;
  OrderNumber: string;
}

const LIST_EXISTS: string = 'List exists';

export default class SpPnPjsExampleViewModel {
  public description: KnockoutObservable<string> = ko.observable('');
  public newItemTitle: KnockoutObservable<string> = ko.observable('');
  public newItemNumber: KnockoutObservable<string> = ko.observable('');
  public items: KnockoutObservableArray<OrderListItem> = ko.observableArray([]);

  public labelClass: string = styles.label;
  public spPnPjsExampleClass: string = styles.spPnPjsExample;
  public containerClass: string = styles.container;
  public rowClass: string = `ms-Grid-row ms-bgColor-themeDark ms-fontColor-white ${styles.row}`;
  public buttonClass: string = `ms-Button ${styles.button}`;

  constructor(bindings: ISpPnPjsExampleBindingContext) {
    this.description(bindings.description);

    // When the web part description is updated, change this view model's description.
    bindings.shouter.subscribe((value: string) => {
      this.description(value);
    }, this, 'description');

    // Load the items
    this.getItems().then((items: OrderListItem[]): void => {
      this.items(items);
    });
  }

  /**
   * Gets the items from the list
   */
  private getItems(): Promise<OrderListItem[]> {
    return this.ensureList().then((list: List): Promise<OrderListItem[]> => {
      // Here we are using the getAs operator so that our returned value will be typed
      return list.items.select("Id", "Title", "OrderNumber").getAs<OrderListItem[]>();
    });
  }

  /**
   * Adds an item to the list
   */
  public addItem(): void {
    if (this.newItemTitle() !== "" && this.newItemNumber() !== "") {
      this.ensureList().then((list: List): Promise<ItemAddResult> => {
        // Add the new item to the SharePoint list
        return list.items.add({
          Title: this.newItemTitle(),
          OrderNumber: this.newItemNumber(),
        });
      }).then((iar: ItemAddResult) => {
        // Add the new item to the display
        this.items.push({
          Id: iar.data.Id,
          OrderNumber: iar.data.OrderNumber,
          Title: iar.data.Title,
        });

        // Clear the form
        this.newItemTitle("");
        this.newItemNumber("");
      });
    }
  }

  /**
   * Deletes an item from the list
   */
  public deleteItem(data): void {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    this.ensureList().then((list: List): Promise<void> => {
      return list.items.getById(data.Id).delete();
    }).then(_ => {
      this.items.remove(data);
    }).catch((e: Error) => {
      alert(`There was an error deleting the item: ${e.message}`);
    });
  }

  /**
   * Ensures the list exists. If not, it creates it and adds some default example data
   */
  private ensureList(): Promise<List> {
    return new Promise<List>((resolve: (list: List) => void, reject: (err: string) => void): void => {
      let listEnsureResults: ListEnsureResult;
      // Use lists.ensure to always have the list available
      pnp.sp.web.lists.ensure("SPPnPJSExampleList")
        .then((ler: ListEnsureResult): Promise<FieldAddResult> => {
          listEnsureResults = ler;

          if (!ler.created) {
            // resolve main promise
            resolve(ler.list);
            // break promise chain
            return Promise.reject(LIST_EXISTS);
          }

          // We created the list on this call, so let's add a column
          return ler.list.fields.addText("OrderNumber");
        }).then((): Promise<string> => {
          console.warn('Adding items...');
          // And we will also add a few items so we can see some example data
          // Here we use batching
          return listEnsureResults.list.getListItemEntityTypeFullName();
        }).then((typeName: string): Promise<void> => {
          // Create a batch
          const batch = pnp.sp.web.createBatch();
          listEnsureResults.list.items.inBatch(batch).add({
            Title: "Title 1",
            OrderNumber: "4826492"
          }, typeName);

          listEnsureResults.list.items.inBatch(batch).add({
            Title: "Title 2",
            OrderNumber: "828475"
          }, typeName);

          listEnsureResults.list.items.inBatch(batch).add({
            Title: "Title 3",
            OrderNumber: "75638923"
          }, typeName);

          // Execute the batched operations
          return batch.execute();
        }).then((): void => {
          // All of the items have been added within the batch
          resolve(listEnsureResults.list);
        }).catch((e: any): void => {
          if (e !== LIST_EXISTS) {
            reject(e);
          }
        });
    });
  }
}